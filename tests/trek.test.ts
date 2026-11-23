import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bridge, bridgeX, bridgeHeight, castContains, distance, floor, passSite, strikeContact, Trek, type Control } from '../src/world.ts'

import { clearCameraFraction } from '../src/camera_clearance.ts'

function tick(trek:Trek, control:Control={x:0,z:0}) {
  trek.step(.04,control)
  assert(!trek.fallen)
}

function advance(trek:Trek, stopped:()=>boolean, combat=false) {
  for(let i=0;i<3700&&!stopped();i++){
    const pick = trek.upgrade?.find(option=>['iron','sweep','rhythm','mail','oak','cleave'].includes(option.id))
    if(pick) assert(trek.chooseTalent(pick.id))
    const goal = trek.objective
    const opponent = combat ? trek.enemiesAlive
      .filter(enemy=>distance(trek.hero,enemy)<16)
      .sort((a,b)=>distance(trek.hero,a)-distance(trek.hero,b))[0] : undefined
    const target = opponent ?? goal
    const d = distance(trek.hero,target)
    const nearby = opponent ? 2.31 : 1
    const move = d > nearby ? {x:(target.x-trek.hero.x)/d,z:(target.z-trek.hero.z)/d} : {x:0,z:0}
    const boss = trek.warden
    const mist = boss?.intent?.kind === 'mist' && distance(trek.hero,boss)<trek.stats.sealReach && !trek.cooldowns.seal && !trek.gcd
    const threat = trek.enemiesAlive.find(enemy=>enemy.intent && enemy.intent.time<=.16 && castContains(enemy,enemy.intent,trek.hero))
    const defensive = threat && !mist && !trek.cooldowns.roll
    if(defensive) {
      const yaw = threat.intent!.yaw
      Object.assign(move,{x:Math.cos(yaw),z:-Math.sin(yaw)})
    }
    const skill = mist ? 'seal' : defensive ? 'roll' : trek.hero.hp<trek.stats.health*.68&&!trek.cooldowns.heal&&!trek.gcd
      ? 'heal' : opponent ? 'strike' : undefined
    tick(trek,{...move,select:mist ? boss!.id : opponent?.id,skill})
  }
  assert(stopped(), 'Reached no valid next step during '+trek.quest+' at '+Math.round(trek.seconds)+'s')
}

function defend(trek: Trek) {
  for(let i=0;i<3;i++) {
    advance(trek,()=>!!trek.prompt)
    tick(trek,{x:0,z:0,interact:true})
    assert(trek.ritual)
    advance(trek,()=>!trek.ritual,true)
  }
}

test('A new ranger can finish the questline with normal game actions', () => {
  const trek = new Trek()
  assert.equal(trek.level,1)
  assert(trek.blocked({x:bridgeX,z:(bridge.min+bridge.max)/2}))
  tick(trek,{x:0,z:0,skill:'seal'})
  assert.equal(trek.cooldowns.seal,0)

  advance(trek,()=>!!trek.prompt)
  tick(trek,{x:0,z:0,interact:true})
  assert.equal(trek.quest,'hunt')
  advance(trek,()=>trek.quest==='light',true)
  assert.equal(trek.level,2)
  assert.equal(trek.huntKills,3)
  defend(trek)
  assert.equal(trek.quest,'warden')
  assert(!trek.blocked({x:bridgeX,z:(bridge.min+bridge.max)/2}))
  const recovered = new Trek(trek.checkpoint)
  assert(recovered.lit.every(Boolean))
  assert.equal(recovered.quest,'warden')
  advance(trek,()=>trek.quest==='report',true)
  assert.equal(trek.level,5)
  advance(trek,()=>!!trek.prompt)
  tick(trek,{x:0,z:0,interact:true})
  assert.equal(trek.quest,'pass')
  assert.equal(trek.chapter,2)
  assert(!trek.blocked({x:passSite.x,z:passSite.z-1}))
  advance(trek,()=>!!trek.prompt)
  assert.equal(trek.zone,'Ashwood Clearing')
  tick(trek,{x:0,z:0,interact:true})
  assert.equal(trek.quest,'watch')
  advance(trek,()=>trek.quest==='anchors',true)
  defend(trek)
  assert.equal(trek.quest,'sentinel')
  assert.equal(trek.watchKills,2)
  assert.equal(trek.warden?.kind,'sentinel')
  advance(trek,()=>trek.quest==='clear',true)
  assert.equal(trek.level,8)
  assert.equal(trek.xp,833)
  assert.equal(trek.talents.length,6)
  assert(trek.seconds>=300 && trek.seconds<=600, `Finished in ${trek.seconds.toFixed(1)} seconds`)
  console.log('Active gameplay:',trek.seconds.toFixed(1),'seconds')

})

test('Seal interrupts the Warden mist cast after leveling up', () => {
  const trek=new Trek({quest:'warden',lit:[true,true,true],huntKills:3,seconds:0})
  const warden=trek.warden!
  trek.hero.x=warden.x+3.5
  trek.hero.z=warden.z
  warden.intent={kind:'mist',time:1.4,yaw:0}
  tick(trek,{x:0,z:0,skill:'strike'})
  assert(trek.action?.skill==='strike')
  tick(trek,{x:0,z:0,skill:'seal'})
  assert.equal(trek.action?.skill,'seal')
  assert.equal(warden.intent,undefined)
  assert.equal(warden.hp,warden.hpMax-34)
  assert.equal(trek.message,'Mistcall interrupted')
})

test('A checkpoint preserves the hounds that were not defeated', () => {
  const trek = new Trek({quest:'hunt',lit:[false,false,false],huntKills:0,seconds:0})
  const hound = trek.enemies[2]
  trek.hero.x = hound.x
  trek.hero.z = hound.z + 1.8
  for (let i=0;i<80 && trek.huntKills===0;i++) tick(trek,{x:0,z:0,skill:'strike'})
  assert.equal(trek.huntKills,1)
  const resumed = new Trek(trek.checkpoint)
  assert.deepEqual(resumed.enemiesAlive.map(enemy=>enemy.id),['hound-0','hound-1'])
})

test('Combat reads the same rotated sectors, lanes and circles as the warnings', () => {
  const origin = {x:2, z:3}
  assert(castContains(origin, {kind:'rush', yaw:Math.PI/2}, {x:11, z:3}))
  assert(!castContains(origin, {kind:'rush', yaw:Math.PI/2}, {x:11, z:4.2}))
  assert(!castContains(origin, {kind:'rush', yaw:Math.PI/2}, {x:1.5, z:3}))
  assert(castContains(origin, {kind:'arc', yaw:Math.PI/2}, {x:5, z:5}))
  assert(!castContains(origin, {kind:'arc', yaw:Math.PI/2}, {x:1, z:5}))
  assert(castContains(origin, {kind:'mist', yaw:0}, {x:2, z:-5}))
  assert(!castContains(origin, {kind:'mist', yaw:0}, {x:2, z:-5.2}))
})

test('A melee attack applies damage only when the staff reaches the target', () => {
  const trek = new Trek({quest:'hunt',lit:[false,false,false],huntKills:0,seconds:0})
  const hound = trek.enemies[0]
  trek.hero.x = hound.x
  trek.hero.z = hound.z + 1.8
  tick(trek,{x:0,z:0,skill:'strike'})
  assert(hound.hp === hound.hpMax)
  assert(trek.action!.age < strikeContact)
  for (let i=0;i<5;i++) tick(trek)
  assert.equal(hound.hp, hound.hpMax - 20)
  assert.equal(trek.effects.filter(effect => effect.kind === 'strike').length, 1)
})

test('A step out of melee range loses contact, and a roll cancels a pending attack', () => {
  const makeDuel = () => {
    const trek = new Trek({quest:'hunt',lit:[false,false,false],huntKills:0,seconds:0})
    const hound = trek.enemies[0]
    trek.hero.x = hound.x
    trek.hero.z = hound.z + 2.99
    return {trek,hound}
  }
  const missed = makeDuel()
  tick(missed.trek,{x:0,z:0,skill:'strike'})
  for (let i=0;i<5;i++) tick(missed.trek,{x:0,z:1})
  assert.equal(missed.hound.hp,missed.hound.hpMax)
  assert(missed.trek.effects.some(effect => effect.kind === 'miss'))

  const rolled = makeDuel()
  tick(rolled.trek,{x:0,z:0,skill:'strike'})
  tick(rolled.trek,{x:1,z:0,skill:'roll'})
  for (let i=0;i<7;i++) tick(rolled.trek)
  assert.equal(rolled.hound.hp,rolled.hound.hpMax)
  assert(rolled.trek.effects.some(effect => effect.kind === 'roll'))
  assert(!rolled.trek.effects.some(effect => effect.kind === 'strike'))
})

test('Autoattack selects a visible foe and waits until it is facing and in range', () => {
  const trek = new Trek({quest:'hunt',lit:[false,false,false],huntKills:0,seconds:0})
  const [near, visible] = trek.enemies
  Object.assign(trek.hero,{x:near.x,z:near.z+3.8})
  tick(trek,{x:0,z:0,cycle:true,visible:[visible.id]})
  assert.equal(trek.target,visible)
  tick(trek,{x:0,z:0,select:near.id,auto:true})
  assert.equal(trek.autoStatus,'Move closer')
  assert.equal(trek.cooldowns.strike,0)
  trek.hero.z = near.z + 2.7
  trek.hero.yaw = 0
  tick(trek)
  assert.equal(trek.autoStatus,'Face your target')
  assert.equal(near.hp,near.hpMax)
  trek.hero.yaw = Math.PI
  for (let i = 0; i < 20; i++) tick(trek)
  assert.equal(near.hp,near.hpMax-20)
  tick(trek,{x:0,z:0,auto:true})
  for (let i = 0; i < 35; i++) tick(trek)
  assert.equal(near.hp,near.hpMax-20)
})

test('An invalid ranged ability does not consume spirit or start either cooldown', () => {
  const trek = new Trek({quest:'warden',lit:[true,true,true],huntKills:3,seconds:0})
  tick(trek,{x:0,z:0,cycle:true,skill:'seal'})
  assert.equal(trek.cooldowns.seal,0)
  assert.equal(trek.gcd,0)
  assert.equal(trek.hero.spirit,100)
  tick(trek,{x:0,z:0,skill:'heal'})
  assert(trek.gcd>0)
  const boss=trek.warden!
  Object.assign(trek.hero,{x:boss.x,z:boss.z+3})
  tick(trek,{x:0,z:0,skill:'seal'})
  assert.equal(boss.hp,boss.hpMax)
})

test('Completed saves from the first release open the route to the second chapter', () => {
  const trek = new Trek({quest:'clear',lit:[true,true,true],huntKills:3,seconds:96})
  assert.equal(trek.quest,'pass')
  assert.equal(trek.xp,370)
  assert.equal(trek.checkpoint.seconds,96)
  const completed = new Trek({...trek.snapshot(),quest:'clear',watchKills:2})
  assert.equal(completed.level,7)
})

test('Camera retracts before a rendered slope, a stone and the raised bridge deck', () => {
  const pivot = {x:0,z:-70,y:floor(0,-70)+1.6}
  const lowEye = {x:17,z:-70,y:pivot.y}
  assert(clearCameraFraction(pivot,lowEye,[])<.8)
  const tree = {x:0,z:-66,base:1,top:6,radius:.65}
  const eye = {...pivot,z:-63}
  assert.equal(clearCameraFraction(pivot,eye,[]),1)
  assert(clearCameraFraction(pivot,eye,[tree])<.56)
  const middle = (bridge.min+bridge.max)/2
  assert(clearCameraFraction({x:bridgeX,z:bridge.max-1,y:1.1},{x:bridgeX,z:middle,y:1.1},[])<1)
})

test('The entire walkable bridge width meets both banks at the deck height', () => {
  for (const [z, dir] of [[bridge.min,-1],[bridge.max,1]]) {
    assert.equal(bridgeHeight(z),bridge.landing)
    for (const x of [bridgeX-1.78,bridgeX,bridgeX+1.78]) {
      assert(Math.abs(floor(x,z+.015*dir)-floor(x,z-.015*dir))<.025)
    }
  }
})

test('A defense waits for time inside the circle and all waves', () => {
  const trek = new Trek({quest:'light',lit:[false,false,false],huntKills:3,seconds:0,talents:['iron']})
  Object.assign(trek.hero,trek.objective)
  tick(trek,{x:0,z:0,interact:true})
  assert(trek.ritual)
  assert.equal(trek.enemies.length,1)
  assert.equal(trek.lit.filter(Boolean).length,0)
  Object.assign(trek.hero,{x:35,z:34})
  const before = trek.ritual.elapsed
  for(let i=0;i<100;i++) tick(trek)
  assert.equal(trek.ritual.elapsed,before)
  assert.equal(trek.checkpoint.lit.filter(Boolean).length,0)
})

test('A selected upgrade changes combat stats and survives a saved checkpoint', () => {
  const trek = new Trek({quest:'light',lit:[false,false,false],huntKills:3,seconds:0})
  assert(!trek.chooseTalent('spring'))
  assert(trek.chooseTalent('breastplate'))
  assert.equal(trek.hero.hp,118)
  assert(!trek.chooseTalent('iron'))
  const resumed = new Trek(trek.checkpoint)
  assert.equal(resumed.hero.hp,118)
  assert.deepEqual(resumed.talents,['breastplate'])
  assert.equal(resumed.upgrade,undefined)
})

test('A sentry heals the marked ally unless the player interrupts the caster', () => {
  for (const interrupt of [true,false]) {
    const trek = new Trek({quest:'warden',lit:[true,true,true],huntKills:3,seconds:0})
    const boss = trek.warden!
    const sentry = {...boss,id:'support',kind:'sentry' as const,x:boss.x+4,hp:66,hpMax:66,ready:0}
    boss.hp -= 50
    boss.stagger = 5
    trek.enemies.push(sentry)
    Object.assign(trek.hero,{x:boss.x+4,z:boss.z+3})
    tick(trek)
    assert.equal(sentry.intent?.kind,'mend')
    assert.equal(sentry.intent?.allyId,boss.id)
    assert(!castContains(sentry,sentry.intent!,trek.hero))
    if (interrupt) tick(trek,{x:0,z:0,select:sentry.id,skill:'seal'})
    for (let i=0;i<47;i++) tick(trek)
    assert.equal(boss.hp,boss.hpMax-(interrupt ? 50 : 12))
    assert.equal(trek.effects.some(effect=>effect.kind==='mend'),!interrupt)
  }
})

test('A follow-up bite can be avoided by stepping out after the first lunge', () => {
  for (const retreat of [false,true]) {
    const trek = new Trek({quest:'hunt',lit:[false,false,false],huntKills:0,seconds:0})
    const hound = trek.enemies[0]
    Object.assign(trek.hero,{x:hound.x,z:hound.z+2.4,invulnerable:.12})
    hound.intent = {kind:'fang',time:.04,yaw:0}
    for (let i=0;i<25 && hound.intent?.kind!=='jab';i++) tick(trek)
    assert.equal(hound.intent?.kind,'jab')
    for (let i=0;i<14;i++) tick(trek,{x:0,z:retreat ? 1 : 0})
    assert.equal(trek.hero.hp,retreat ? 100 : 86)
  }
})

test('Clearing a wave early gives a short breather that pauses outside the circle', () => {
  const trek = new Trek({quest:'light',lit:[false,false,false],huntKills:3,seconds:0})
  Object.assign(trek.hero,trek.objective)
  tick(trek,{x:0,z:0,interact:true})
  const ritual=trek.ritual!
  const site={x:trek.hero.x,z:trek.hero.z}
  trek.enemies[0].hp=0
  Object.assign(trek.hero,{x:35,z:34})
  for(let i=0;i<160;i++) tick(trek)
  assert.equal(ritual.wave,1)
  Object.assign(trek.hero,site)
  for(let i=0;i<120;i++) tick(trek)
  assert.equal(ritual.wave,1)
  for(let i=0;i<8;i++) tick(trek)
  assert.equal(ritual.wave,2)
})

test('Staff contact earns spirit once, and a ready spell still needs its full cost', () => {
  const trek=new Trek({quest:'warden',lit:[true,true,true],huntKills:3,seconds:0})
  const boss=trek.warden!
  Object.assign(trek.hero,{x:boss.x,z:boss.z+2.8,spirit:23})
  tick(trek,{x:0,z:0,skill:'seal'})
  assert.equal(trek.cooldowns.seal,0)
  assert.equal(boss.hp,boss.hpMax)
  tick(trek,{x:0,z:0,skill:'strike'})
  assert(trek.hero.spirit<24)
  for(let i=0;i<6;i++) tick(trek)
  assert(trek.hero.spirit>=27 && trek.hero.spirit<28)
  tick(trek,{x:0,z:0,skill:'seal'})
  assert(trek.cooldowns.seal>0)
  assert(trek.hero.spirit<2)
  tick(trek,{x:0,z:0,auto:true})
  const before=trek.hero.spirit
  for(let i=0;i<25;i++) tick(trek)
  tick(trek,{x:0,z:0,skill:'heal'})
  assert.equal(trek.cooldowns.heal,0)
  assert(trek.hero.spirit>before && trek.hero.spirit<before+2)
})

test('Walking and rolling stop outside a solid beacon while interaction stays in reach', () => {
  const site={x:-14,z:7}
  const y=floor(site.x,site.z)
  const obstacle={...site,base:y,top:y+2.45,radius:.79}
  for (const roll of [false,true]) {
    const trek=new Trek({quest:'light',lit:[false,false,false],huntKills:3,seconds:0},[obstacle])
    Object.assign(trek.hero,{x:site.x,z:site.z+3})
    for(let i=0;i<25;i++) tick(trek,{x:0,z:-1,skill:roll && i===0 ? 'roll' : undefined})
    assert(distance(trek.hero,site)>=obstacle.radius+.42)
    assert.equal(trek.prompt,'Light the waybeacon')
    const from={...trek.hero,y:y+1.64}
    const fraction=clearCameraFraction(from,{x:site.x,y:y+1.8,z:site.z-4},[obstacle])
    assert(fraction<.3)
    assert(from.z+(site.z-4-from.z)*fraction>site.z+obstacle.radius)
  }
})
