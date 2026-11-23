import './style.css'
import { SceneView } from './scene.ts'
import { loadArtwork } from './artwork.ts'
import { talentRows } from './talents.ts'
import { orders, runeNames } from './orders.ts'
import { Minimap } from './minimap.ts'
import { telegraphFillOf } from './vendor/telegraph_look_core.ts'
import { castContains, casts, distance, enemyName, floor, globalRecharge, initialSave, interruptible, isBoss, mira, skillLevel, strikeSpirit, validLog, Trek, type Intent, type Quest, type Skill, type TrekSave } from './world.ts'

function el<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id)! as T
}

const canvas = el<HTMLCanvasElement>('view')
const start = el<HTMLButtonElement>('play')
const sound = el<HTMLButtonElement>('sound')
const pause = el<HTMLButtonElement>('pause')
const title = el('title-screen')
const hud = el('hud')
const dialog = el<HTMLDialogElement>('dialog')
const dialogContent = el('dialog-content')
const storageKey = 'dozor-u-perepravy.v1'
const progression: Quest[] = ['meet', 'hunt', 'light', 'warden', 'report', 'pass', 'watch', 'anchors', 'sentinel', 'clear', 'orders', 'dawn']

function loadSave(): TrekSave {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<TrekSave> | null
    if (value?.quest && progression.includes(value.quest) && Array.isArray(value.lit) && value.lit.length === 3 &&
      (value.field === undefined || validLog(value.field)) &&
      (value.hounds === undefined || Array.isArray(value.hounds) && value.hounds.every(id => typeof id === 'string')) &&
      (value.watchKills === undefined || Number.isInteger(value.watchKills) && value.watchKills >= 0 && value.watchKills <= 2) &&
      (value.anchors === undefined || Array.isArray(value.anchors) && value.anchors.length === 3 &&
        value.anchors.every(item=>typeof item==='boolean')) &&
      (value.talents === undefined || Array.isArray(value.talents) && value.talents.length <= talentRows.length &&
        value.talents.every((id,i)=>talentRows[i].some(item=>item.id===id))) &&
      Number.isInteger(value.huntKills) && value.huntKills! >= 0 && value.huntKills! <= 3 &&
      typeof value.seconds === 'number' && value.seconds >= 0 && Number.isFinite(value.seconds)) return value as TrekSave
  } catch { /* The game can also run without browser storage. */ }
  return initialSave
}

function store(save: TrekSave) {
  try { localStorage.setItem(storageKey, JSON.stringify(save)) } catch { /* Storage may be disabled. */ }
}

const startLabel = start.textContent
start.disabled = true
start.textContent = 'Loading models…'
void loadArtwork().then(art => {
  const view = new SceneView(canvas, art)
  start.textContent = startLabel
  start.disabled = false
  boot(view)
}).catch(error => {
  console.error(error)
  start.disabled = true
  start.textContent = 'Could not load the scene'
  title.querySelector('.pitch')!.textContent = 'Reload the page in a browser that supports WebGL 2.'
})

function boot(view: SceneView) {
  const touch = matchMedia('(pointer: coarse)')
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const tags = el('tags')
  const miraTag = el('mira-tag')
  const joystick = el('joystick')
  const prompt = el('prompt')
  const notice = el('message')
  const heroHp = el('hp')
  const hpBar = el('hp-bar')
  const spiritBar = el('spirit-bar')
  const count = el('quest-count')
  const description = el('quest-hint')
  const questTitle = el('quest-title')
  const xp = el('xp-label')
  const bossHud = el('boss-hud')
  const minimap = new Minimap(el<HTMLCanvasElement>('minimap'))
  const castWarning = el('cast-warning')
  const castName = el('cast-name')
  const castTime = el('cast-time')
  const castProgress = el('cast-progress')
  const castResponse = el('cast-response')
  const controls = document.querySelectorAll<HTMLButtonElement>('[data-skill]')
  const slots = Array.from(controls).map(button => ({
    button,
    skill: button.dataset.skill as Skill,
    timer: button.querySelector<HTMLElement>('.timer')!,
  }))
  const pressed = new Set<string>()
  const touchMove = { x: 0, z: 0 }
  const keys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'])
  const buttons: Record<string, Skill> = {
    KeyF: 'strike', Digit2: 'seal', Digit3: 'heal', Digit4: 'roll', Space: 'roll',
  }
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  let stickId: number | null = null
  let orbitId: number | null = null
  let orbitAt = { x: 0, y: 0 }
  let campaign = new Trek(initialSave,view.obstacles)
  let inGame = false
  let dialogType = ''
  let auto = false
  let selection: string | undefined
  let pointerTravel = 0
  let nextSkill: Skill | undefined
  let interact = false
  let cycle = false
  let lastSave = campaign.checkpoint
  let lastQuest: string | undefined
  let nextHudAt = 0
  let silent = false
  let audio: AudioContext | undefined
  const heard = new WeakSet<object>()
  const heardCasts = new WeakSet<Intent>()

  function prepareSound() {
    if (silent) return
    try {
      audio ??= new AudioContext()
      if (audio.state === 'suspended') void audio.resume().catch(() => {})
    } catch { audio = undefined }
  }

  function playSound(from: number, to: number, seconds = .16, type: OscillatorType = 'triangle') {
    if (silent || !audio || audio.state !== 'running') return
    const osc = audio.createOscillator()
    const volume = audio.createGain()
    const time = audio.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(from, time)
    osc.frequency.exponentialRampToValueAtTime(to, time + seconds)
    volume.gain.setValueAtTime(.001, time)
    volume.gain.exponentialRampToValueAtTime(.094, time + .024)
    volume.gain.exponentialRampToValueAtTime(.001, time + seconds)
    osc.connect(volume).connect(audio.destination)
    osc.start()
    osc.stop(time + seconds)
  }

  function release() {
    pressed.clear()
    auto = false
    selection = undefined
    pointerTravel = 0
    stickId = null
    orbitId = null
    touchMove.x = touchMove.z = 0
    joystick.querySelector('i')!.style.transform = ''
    nextSkill = undefined
    interact = false
    cycle = false
  }

  function refreshTitle() {
    const saved = loadSave()
    start.textContent = saved.quest !== 'meet' && saved.quest !== 'dawn' ? 'Resume watch' : 'Take the trail'
  }

  function goHome() {
    inGame = false
    if (dialog.open) dialog.close()
    campaign = new Trek(initialSave,view.obstacles)
    view.reset()
    release()
    title.hidden = false
    hud.hidden = pause.hidden = true
    refreshTitle()
  }

  function bringBack(saved: TrekSave) {
    if (dialog.open) dialog.close()
    inGame = true
    release()
    const resume = saved.quest === 'clear' && saved.watchKills !== undefined ? {...saved,quest:'orders' as const} : saved
    campaign = new Trek(resume.quest === 'dawn' ? initialSave : resume,view.obstacles)
    store(campaign.checkpoint)
    lastSave = campaign.checkpoint
    lastQuest = undefined
    hud.hidden = pause.hidden = false
    title.hidden = true
    view.reset()
    updateHud()
    prepareSound()
    canvas.focus({preventScroll:true})
  }

  function openPanel(kind: string, markup: string) {
    release()
    dialogType = kind
    dialog.toggleAttribute('data-upgrade', kind === 'upgrade' || kind === 'cipher')
    dialogContent.innerHTML = markup
    if (!dialog.open) dialog.showModal()
    dialogContent.querySelector<HTMLButtonElement>('button')?.focus()
  }

  let pendingTalent = ''
  function pickUpgrade() {
    const cards = campaign.upgrade
    if (!cards) return
    pendingTalent = ''
    openPanel('upgrade', `
      <header class="upgrade-heading">
        <span>Level ${campaign.talents.length + 2}</span>
        <h2 id="dialog-title">Choose an upgrade</h2>
      </header>
      <div class="upgrade-cards">${cards.map((talent,i)=>`
        <button class="upgrade-card" aria-pressed="false" data-talent="${talent.id}" data-icon="${talent.icon}">
          <span class="upgrade-art" aria-hidden="true"></span><kbd aria-hidden="true">${i+1}</kbd>
          <strong>${talent.name}</strong><span>${talent.text}</span>
        </button>
      `).join('')}</div>
      <div class="dialog-actions"><button class="primary" type="button" data-command="accept" disabled>Accept upgrade</button></div>`)
  }

  function previewTalent(id: string) {
    pendingTalent=id
    for (const button of dialogContent.querySelectorAll<HTMLButtonElement>('[data-talent]')) {
      button.setAttribute('aria-pressed',String(button.dataset.talent===id))
    }
    dialogContent.querySelector<HTMLButtonElement>('[data-command="accept"]')!.disabled=false
  }

  function applyUpgrade(id: string) {
    if (dialogType !== 'upgrade' || !campaign.chooseTalent(id)) return
    lastSave = campaign.checkpoint
    store(lastSave)
    updateHud()
    playSound(396,660,.23)
    if (campaign.upgrade) pickUpgrade()
    else dialog.close()
  }

  function help() {
    openPanel('help', `
      <h2 id="dialog-title">Controls</h2>
      <dl class="keylist">
        <dt><kbd>WASD</kbd> <kbd>↑↓←→</kbd></dt><dd>Move relative to the camera</dd>
        <dt><kbd>RMB</kbd> <kbd>Wheel</kbd></dt><dd>Orbit and zoom. Press R to face your objective</dd>
        <dt><kbd>E</kbd></dt><dd>Speak or light a beacon</dd>
        <dt><kbd>Tab</kbd> <kbd>LMB</kbd></dt><dd>Select a target</dd>
        <dt><kbd>1</kbd></dt><dd>Toggle auto-attack</dd>
        <dt><kbd>F</kbd></dt><dd>Strike once. Each hit restores ${strikeSpirit} Spirit, including hits from auto-attack</dd>
        ${campaign.level >= skillLevel.seal ? '<dt><kbd>2</kbd></dt><dd>Seal costs ' + campaign.spiritCost('seal') + ' Spirit and interrupts Mistcall or an enemy heal</dd>' : ''}
        <dt><kbd>3</kbd></dt><dd>Heal costs ${campaign.stats.healCost} Spirit</dd>
        <dt><kbd>4</kbd> <kbd>Space</kbd></dt><dd>Roll to briefly evade damage</dd>
      </dl>
      <p>Use the joystick to move. Tap an enemy to target it. Drag the scene to orbit.</p>
      <div class="dialog-actions"><button class="primary" data-command="close">Got it</button></div>`)
  }

  function showCipher(retry = false) {
    const length = campaign.job.runes!.length
    const marks = Array.from({length}, (_, i) => i < campaign.runeIndex ? '◆' : '◇').join(' ')
    openPanel('cipher', `
      <h2 id="dialog-title">${campaign.job.name}</h2>
      <p>The inscription reads “${campaign.inscription}”. Touch its marks in order.</p>
      <p aria-live="polite">${retry ? 'The stone went dark. Start again. ' : ''}${marks}</p>
      <div class="dialog-actions">${Object.entries(runeNames).map(([key, name]) =>
        '<button class="quiet" data-rune="'+key+'">'+name+'</button>').join('')}</div>`)
  }

  function showPause() {
    const learned = campaign.talents.map((id,i)=>talentRows[i].find(card=>card.id===id)!.name)
    openPanel('pause', `
      <h2 id="dialog-title">Pause</h2><p>${campaign.fieldTitle}</p>
      ${learned.length ? '<p class="learned"><strong>Upgrades</strong> · '+learned.join(', ')+'</p>' : ''}
      <div class="dialog-actions"><button class="primary" data-command="close">Resume</button>
      <button class="quiet" data-command="help">Controls</button>
      <button class="text-button" data-command="home">Main menu</button></div>`)
  }

  function end() {
    const fallen = campaign.fallen
    const interlude = !fallen && campaign.quest === 'clear'
    const seconds = Math.floor(campaign.seconds)
    const elapsed = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0')
    inGame = false
    openPanel('end', `
      <h2 id="dialog-title">${fallen ? 'The ranger fell' : interlude ? 'The northern watch is restored' : 'Dawn over the crossing'}</h2>
      <p>${fallen ? 'Return to the last checkpoint. Lit beacons and earned XP carry over.' :
        interlude ? 'The watchfire burns again. At the ferry landing, Mira has nine field orders for you. The first concerns a missing ferryman.' : 'The Barrow King has fallen. At first light the ferry sets out, the grain comes ashore, and the watch can finally stand down.'}</p>
      ${fallen ? '' : '<p>Level ' + campaign.level + ' · ' + campaign.xp + ' XP · ' + elapsed + '</p>'}
      <div class="dialog-actions"><button class="primary" data-command="${fallen ? 'retry' : interlude ? 'orders' : 'home'}">${fallen ? 'Retry from checkpoint' : interlude ? 'Take the field orders' : 'Main menu'}</button>
      ${fallen ? '<button class="text-button" data-command="home">Main menu</button>' : ''}</div>`)
  }

  dialogContent.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    const rune = event.target.closest<HTMLButtonElement>('[data-rune]')?.dataset.rune
    if (rune && dialogType === 'cipher') {
      const matched = campaign.enterRune(rune)
      playSound(matched ? 392 : 182, matched ? 554 : 120)
      if (campaign.cipherOpen) showCipher(!matched)
      else { store(campaign.checkpoint); dialog.close(); updateHud() }
      return
    }
    const option = event.target.closest<HTMLButtonElement>('[data-talent]')?.dataset.talent
    if (option) { previewTalent(option); return }
    const command = event.target.closest<HTMLButtonElement>('[data-command]')?.dataset.command
    if (command === 'accept' && pendingTalent) applyUpgrade(pendingTalent)
    if (command === 'close') dialog.close()
    if (command === 'help') help()
    if (command === 'home') goHome()
    if (command === 'orders') bringBack(campaign.checkpoint)
    if (command === 'retry') bringBack(campaign.checkpoint)
  })
  dialog.addEventListener('cancel', event => {
    if (dialogType === 'upgrade' || dialogType === 'cipher') event.preventDefault()
  })
  dialog.addEventListener('keydown', event => {
    if (dialogType !== 'upgrade' || !['Digit1','Digit2','Digit3'].includes(event.code) || event.repeat) return
    const option = campaign.upgrade?.[Number(event.code.at(-1))-1]
    if (!option) return
    event.preventDefault()
    previewTalent(option.id)
  })
  dialog.addEventListener('close', () => {
    if (dialogType === 'end' && !inGame) goHome()
    else if (inGame && !dialog.open) canvas.focus({preventScroll:true})
  })

  el('home').addEventListener('click', goHome)
  el('title-help').addEventListener('click', help)
  el('help').addEventListener('click', help)
  pause.addEventListener('click', showPause)
  start.addEventListener('click', () => bringBack(loadSave()))
  sound.addEventListener('click', event => {
    silent = !silent
    sound.setAttribute('aria-pressed', String(!silent))
    prepareSound()
    playSound(270,420)
    if (inGame && event.detail > 0) canvas.focus({preventScroll:true})
  })
  el('touch-use').addEventListener('click', () => { interact = true })
  for (const {button,skill} of slots) {
    button.addEventListener('click', event => {
      if (!inGame || dialog.open) return
      if (skill === 'strike') auto = true
      else nextSkill = skill
      if (!touch.matches && event.detail > 0) canvas.focus({preventScroll:true})
    })
  }

  addEventListener('keydown', event => {
    if (!inGame || dialog.open || event.ctrlKey || event.altKey || event.metaKey) return
    const {code} = event
    if (code === 'Escape') { event.preventDefault(); showPause(); return }
    if (code === 'Space' && event.target instanceof HTMLButtonElement) return
    if (!keys.has(code) && !buttons[code] && !['KeyE','KeyT','KeyR','Tab','Digit1'].includes(code)) return
    if (code === 'Tab' && (event.shiftKey || document.activeElement !== canvas)) return
    event.preventDefault()
    pressed.add(code)
    if (event.repeat) return
    if (buttons[code]) nextSkill = buttons[code]
    if (code === 'KeyE') interact = true
    if (code === 'KeyT' || code === 'Tab') cycle = true
    if (code === 'Digit1') auto = true
    if (code === 'KeyR') view.toward(campaign.objective,campaign.hero)
  })
  addEventListener('keyup', event => pressed.delete(event.code))
  function whenAway() {
    release()
    if (inGame && !dialog.open) showPause()
  }
  addEventListener('blur', whenAway)
  document.addEventListener('visibilitychange', () => { if(document.hidden) whenAway() })

  canvas.addEventListener('contextmenu', event => event.preventDefault())
  canvas.addEventListener('wheel', event => {
    if (!inGame || dialog.open) return
    event.preventDefault()
    view.scroll(event.deltaY)
  }, {passive:false})
  canvas.addEventListener('pointerdown', event => {
    if (!inGame || dialog.open) return
    if (event.pointerType === 'touch' || event.button === 2) {
      orbitId = event.pointerId
      orbitAt = {x:event.clientX,y:event.clientY}
      pointerTravel = 0
      canvas.setPointerCapture(event.pointerId)
    } else if (event.button === 0) {
      canvas.focus({preventScroll:true})
      selection = view.pick(event.clientX,event.clientY)
    }
  })
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== orbitId) return
    const dx = event.clientX-orbitAt.x, dy = event.clientY-orbitAt.y
    pointerTravel += Math.hypot(dx,dy)
    if (event.pointerType !== 'touch' || pointerTravel > 6) view.orbit(dx,dy)
    orbitAt = {x:event.clientX,y:event.clientY}
  })
  canvas.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch' && event.pointerId === orbitId && pointerTravel <= 6) {
      selection = view.pick(event.clientX,event.clientY)
    }
  })
  canvas.addEventListener('lostpointercapture', event => { if(event.pointerId===orbitId)orbitId=null })

  function nudge(event: PointerEvent) {
    const rect = joystick.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const z = event.clientY - rect.top - rect.height / 2
    const d = Math.max(26, Math.hypot(x,z))
    touchMove.x = x/d
    touchMove.z = z/d
    joystick.querySelector('i')!.style.transform = 'translate(' + touchMove.x*25 + 'px,' + touchMove.z*25 + 'px)'
  }
  joystick.addEventListener('pointerdown', event => {
    if(stickId!==null)return
    stickId=event.pointerId
    joystick.setPointerCapture(event.pointerId)
    nudge(event)
  })
  joystick.addEventListener('pointermove', event => { if(event.pointerId===stickId)nudge(event) })
  joystick.addEventListener('lostpointercapture', event => {
    if (event.pointerId!==stickId) return
    stickId=null
    touchMove.x=touchMove.z=0
    joystick.querySelector('i')!.style.transform=''
  })

  function meter(element: HTMLElement, fraction: number) {
    element.style.transform = 'scaleX(' + fraction + ')'
  }

  function updateHud() {
    const h = campaign.hero
    if (lastQuest !== campaign.fieldTitle) {
      const name=campaign.fieldTitle
      questTitle.textContent=name
      count.textContent=campaign.quest==='orders' ? campaign.order.title+' · '+(campaign.field.job+1)+' / '+campaign.order.jobs.length : 'Chapter '+campaign.chapter+' / '+(2+orders.length)
      el('announce').textContent=name
      lastQuest=name
    }
    el('zone').textContent = campaign.zone
    const detail=campaign.hint
    description.textContent=touch.matches?detail.replace('press E','tap Interact'):detail
    el('level').textContent=String(campaign.level)
    xp.textContent=campaign.xp+(campaign.nextXp ? ' / '+campaign.nextXp : '')+' XP'
    const defense = el('defense-progress')
    defense.hidden = !campaign.ritual
    if (campaign.ritual) meter(el('defense-fill'),campaign.ritual.wave/campaign.waveSchedule.length)
    heroHp.textContent=String(Math.round(h.hp))
    el('spirit').textContent=String(Math.floor(h.spirit))
    meter(hpBar,h.hp/campaign.stats.health)
    meter(spiritBar,h.spirit/100)
    const goal=campaign.objective
    const bearing=Math.atan2(goal.x-h.x,-(goal.z-h.z))+view.yaw
    el('bearing-arrow').style.transform='rotate('+bearing+'rad)'
    el('bearing-text').textContent=Math.round(distance(h,goal))+' m · R to face objective'
    if(touch.matches) el('bearing-text').textContent=Math.round(distance(h,goal))+' m to objective'
    const action=campaign.prompt
    prompt.hidden=!action
    prompt.querySelector('span')!.textContent=action
    el('touch-use').hidden=!action
    notice.hidden=campaign.messageTime<=0
    const message=touch.matches?campaign.message.replace('press 2','tap Seal'):campaign.message
    if(notice.textContent!==message)notice.textContent=message
    const boss = campaign.warden
    const focus = campaign.target ?? (boss && distance(h,boss) < 20 ? boss : undefined)
    bossHud.hidden = !focus
    if (focus) {
      el('target-name').textContent = focus.title ?? enemyName[focus.kind]
      el('boss-hp').textContent = focus.hp + ' / ' + focus.hpMax
      meter(el('boss-bar'),focus.hp / focus.hpMax)
      const status = el('target-status')
      status.textContent = campaign.autoStatus || Math.round(distance(h,focus)) + ' m'
      status.dataset.state = campaign.autoStatus === 'Auto-attack' ? 'ready' : campaign.autoStatus ? 'blocked' : ''
    }
    const active = campaign.enemiesAlive.filter(enemy => enemy.intent && distance(h,enemy) < 17)
    const threatening = active.filter(enemy => castContains(enemy,enemy.intent!,h))
      .sort((a,b)=>a.intent!.time-b.intent!.time)
    const caster = threatening[0] ?? active.find(enemy=>interruptible(enemy.intent!.kind)) ?? active[0]
    const cast = caster?.intent
    castWarning.hidden = !cast
    if (cast) {
      const spec = casts[cast.kind]
      castWarning.dataset.threat = interruptible(cast.kind) ? 'interrupt' : 'danger'
      castName.textContent = spec.label
      castTime.textContent = formatter.format(Math.ceil(cast.time * 10) / 10) + ' s'
      meter(castProgress, telegraphFillOf(cast.time, spec.seconds))
      const canSeal = !campaign.cooldowns.seal && !campaign.gcd && h.spirit >= campaign.spiritCost('seal') && distance(h,caster) <= campaign.stats.sealReach
      if (interruptible(cast.kind) && canSeal && caster === (campaign.target ?? campaign.enemiesAlive.slice().sort((a,b)=>distance(h,a)-distance(h,b))[0])) {
        castResponse.textContent = touch.matches ? 'Interrupt with Seal' : 'Interrupt with Seal · 2'
      } else if (cast.kind === 'mend') castResponse.textContent = 'Attack the caster'
      else if (cast.kind === 'mist' || cast.kind === 'jab') castResponse.textContent = 'Leave the circle'
      else castResponse.textContent = cast.kind === 'arc' ? 'Step out of the arc' : 'Sidestep the line'
    }
    minimap.draw(campaign, goal)
    for (const {button,skill,timer} of slots) {
      const learned = campaign.level >= skillLevel[skill]
      button.hidden = !learned
      if (!learned) continue
      const time = campaign.cooldowns[skill]
      const shared = skill === 'seal' || skill === 'heal' ? campaign.gcd : 0
      const cost = campaign.spiritCost(skill)
      const short = h.spirit < cost
      const price = button.querySelector<HTMLElement>('.cost')
      if (price) {
        price.textContent = String(cost)
        button.setAttribute('aria-description', cost + ' Spirit' + (short ? '. Not enough Spirit.' : ''))
      }
      button.classList.toggle('low-spirit',short)
      if (cost) button.title = (skill === 'seal' ? 'Seal' : 'Heal') + ' · ' + cost + ' Spirit' + (short ? '. Land a staff hit to regain Spirit.' : '')
      const personal = time > 0
      button.classList.toggle('recharging', personal || shared > 0)
      button.classList.toggle('global-cooldown', !personal && shared > 0)
      button.classList.toggle('out-of-range', skill === 'seal' && !!campaign.target && distance(h,campaign.target) > campaign.stats.sealReach)
      if (skill === 'strike') button.setAttribute('aria-pressed', String(campaign.autoAttacking))
      timer.hidden = !personal && !short
      timer.textContent = personal ? formatter.format(Math.ceil(time * 10) / 10) : short ? 'Low Spirit' : ''
      button.style.setProperty('--remaining', (personal ? time / campaign.recovery(skill) : shared / globalRecharge) * 100 + '%')
    }
  }

  function place(tag: HTMLElement, x: number, y: number, z: number) {
    const p=view.project(x,y,z)
    if(!p.visible||p.x<8||p.x>canvas.clientWidth-8||p.y<69||p.y>canvas.clientHeight-79)return false
    tag.style.left=p.x+'px'
    tag.style.top=p.y+'px'
    return true
  }

  const enemyTags=new Map<string,HTMLDivElement>()
  const impacts: HTMLDivElement[]=[]
  function drawTags() {
    const nearMira=distance(campaign.hero,mira)<16
    miraTag.hidden=!nearMira||!place(miraTag,mira.x,floor(mira.x,mira.z)+2.15,mira.z)
    const seen=new Set<string>()
    for(const enemy of campaign.enemiesAlive){
      if(distance(campaign.hero,enemy)>(isBoss(enemy.kind)?23:17))continue
      let tag=enemyTags.get(enemy.id)
      if(!tag){
        tag=document.createElement('div')
        tag.className='tag'
        tag.innerHTML='<span></span><em><i></i></em>'
        tag.querySelector('span')!.textContent=enemyName[enemy.kind]
        tags.append(tag)
        enemyTags.set(enemy.id,tag)
      }
      seen.add(enemy.id)
      tag.querySelector('span')!.textContent = enemy.intent?.kind === 'mend' ? 'Ash caster · Mending an ally' : enemy.title ?? enemyName[enemy.kind]
      tag.classList.toggle('target',campaign.selected===enemy.id)
      tag.hidden=!place(tag,enemy.x,floor(enemy.x,enemy.z)+(isBoss(enemy.kind)?2.94:enemy.kind==='sentry'?2.2:1.36),enemy.z)
      meter(tag.querySelector('i')!,enemy.hp/enemy.hpMax)
    }
    for(const [id,tag] of enemyTags){
      if(seen.has(id))continue
      tag.remove()
      enemyTags.delete(id)
    }
    const feedback=campaign.effects.filter(e=>e.message)
    for(const [i,effect] of feedback.entries()){
      let tag=impacts[i]
      if(!tag){
        tag=document.createElement('div')
        tag.className='tag damage'
        tags.append(tag)
        impacts.push(tag)
      }
      tag.textContent = effect.message!
      tag.dataset.kind = effect.kind
      tag.style.opacity = String(Math.min(1, effect.ttl / .26))
      const rise = reduceMotion.matches ? 0 : (effect.duration - effect.ttl) * 1.24
      const {x, z} = effect.kind === 'heal' ? campaign.hero : effect
      tag.hidden = !place(tag, x, floor(x, z) + effect.height + .34 + rise, z)
    }
    for(let i=feedback.length;i<impacts.length;i++)impacts[i].hidden=true
  }

  const cue = {
    strike: [150,68,.13], seal: [378,642,.23], light: [335,525,.37],
    mend: [247,494,.24], heal: [281,540,.26], hurt: [93,44,.17], miss: [136,78,.10],
    break: [760,220,.29], roll: [126,71,.16],
  }
  refreshTitle()
  let last = performance.now()
  function frame(now:number){
    const dt=Math.min(.05,Math.max(0,(now-last)/1000))
    last=now
    const active=inGame&&!dialog.open&&!document.hidden
    if(active){
      const screenX=Number(pressed.has('KeyD')||pressed.has('ArrowRight'))-Number(pressed.has('KeyA')||pressed.has('ArrowLeft'))+touchMove.x
      const screenZ=Number(pressed.has('KeyS')||pressed.has('ArrowDown'))-Number(pressed.has('KeyW')||pressed.has('ArrowUp'))+touchMove.z
      const movement=view.move(screenX,screenZ)
      const visible = cycle || auto ? view.visibleEnemies(campaign) : undefined
      campaign.step(dt,{...movement,skill:nextSkill??(pressed.has('KeyF')?'strike':undefined),
        interact,cycle,visible,select:selection,auto,facing:view.yaw+Math.PI})
      nextSkill=undefined
      selection=undefined
      interact=cycle=auto=false
      if(lastSave!==campaign.checkpoint){
        lastSave=campaign.checkpoint
        store(lastSave)
      }
      for(const e of campaign.effects){
        if(heard.has(e))continue
        heard.add(e)
        const [from,to,time]=cue[e.kind]
        playSound(from,to,time)
      }
      for (const enemy of campaign.enemiesAlive) {
        if (!enemy.intent || distance(campaign.hero, enemy) > 16 || heardCasts.has(enemy.intent)) continue
        heardCasts.add(enemy.intent)
        if (interruptible(enemy.intent.kind)) playSound(315, 563, .31, 'sine')
        else playSound(182, 139, .13)
      }
      if(now>=nextHudAt){updateHud();nextHudAt=now+63}
      if(campaign.fallen||campaign.quest==='clear'||campaign.quest==='dawn')end()
      else if(campaign.cipherOpen) showCipher()
      else if(campaign.upgrade) pickUpgrade()
    }
    if(!document.hidden){
      view.draw(campaign,dialog.open?0:dt,!title.hidden)
      if(!hud.hidden)drawTags()
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
