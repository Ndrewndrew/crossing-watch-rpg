import type { Skill } from './world.ts'

export const thresholds = [0,70,150,235,365,495,625,800,1080,1500] as const

const base = {
  melee: 20, cleave: 0, sealBonus: 0, sealReach: 10.3, sealCooldown: 3.2,
  heal: 34, healCost: 30, healCooldown: 6.5, dodge: .42, rollCooldown: 2.7,
  health: 100, strikeCooldown: 1.04, armor: 0, spirit: 1, breakRefund: 0,
}
type Stat = keyof typeof base
type Talent = { id: string; name: string; text: string; icon: Skill; stat: Stat; amount: number }

const card = (id:string,name:string,text:string,icon:Skill,stat:Stat,amount:number): Talent =>
  ({id,name,text,icon,stat,amount})

export const talentRows: readonly (readonly [Talent,Talent,Talent])[] = [
  [
    card('iron','Iron Ferrule','Staff hits deal 5 more damage.','strike','melee',5),
    card('rune','Deep Carving','Seal deals 8 more damage.','seal','sealBonus',8),
    card('breastplate','Padded Cuirass','Gain 18 maximum health.','heal','health',18),
  ],[
    card('sweep','Wide Swing','Staff hits deal 10 damage to a second nearby enemy.','strike','cleave',10),
    card('reach','Long Reach','Extend Seal range by 3 m.','seal','sealReach',3),
    card('balsam','Herbal Tonic','Heal restores 16 more health.','heal','heal',16),
  ],[
    card('rhythm','Steady Rhythm','Shorten the interval between staff hits by 0.21 s.','strike','strikeCooldown',-.21),
    card('etch','Quick Seal','Reduce Seal cooldown by 1.2 s.','seal','sealCooldown',-1.2),
    card('lightstep','Light Boots','Reduce Roll cooldown by 0.55 s.','roll','rollCooldown',-.55),
  ],[
    card('thrift','Field Flask','Heal costs 9 less Spirit.','heal','healCost',-9),
    card('echo','Echoing Seal','Interrupting a spell restores 14 Spirit.','seal','breakRefund',14),
    card('mail','Mail Lining','Take 17% less damage.','heal','armor',.17),
  ],[
    card('oak','Hardened Staff','Staff hits deal 8 more damage.','strike','melee',8),
    card('flare','Burning Seal','Seal deals 15 more damage.','seal','sealBonus',15),
    card('veil','Slip Away','Stay invulnerable for 0.25 s longer when rolling.','roll','dodge',.25),
  ],[
    card('cleave','Cleave','Deal 15 more damage to a second nearby enemy.','strike','cleave',15),
    card('spring','Wellspring','Recover 3 extra Spirit per second.','seal','spirit',3),
    card('suture','Field Dressing','Reduce Heal cooldown by 2.5 s.','heal','healCooldown',-2.5),
  ],[
    card('liniment','Scout’s Liniment','Heal restores 8 more health.','heal','heal',8),
    card('footwork','River Footwork','Reduce Roll cooldown by 0.3 s.','roll','rollCooldown',-.3),
    card('channel','River Channel','Interrupting a spell restores 6 Spirit.','seal','breakRefund',6),
  ],[
    card('binding','Silver Binding','Extend Seal range by 1.5 m.','seal','sealReach',1.5),
    card('stitch','Double Stitch','Gain 12 maximum health.','heal','health',12),
    card('haft','Weighted Haft','Staff hits deal 2 more damage.','strike','melee',2),
  ],[
    card('oath','Healer’s Oath','Spend 4 less Spirit on Heal.','heal','healCost',-4),
    card('slip','Reed Step','Stay invulnerable for 0.1 s longer when rolling.','roll','dodge',.1),
    card('brand','Barrow Brand','Seal deals 6 more damage.','seal','sealBonus',6),
  ],
]

export function talentStats(choices: readonly string[]) {
  const stats = {...base}
  for (const [i,id] of choices.entries()) {
    const talent = talentRows[i]?.find(item=>item.id===id)
    if (talent) stats[talent.stat] += talent.amount
  }
  return stats
}
