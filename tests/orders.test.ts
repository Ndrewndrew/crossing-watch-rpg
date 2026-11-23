import assert from 'node:assert/strict'
import { test } from 'node:test'
import { orders } from '../src/orders.ts'
import { Trek, validLog, type FieldLog } from '../src/world.ts'

function patrol(field: Partial<FieldLog>) {
  return new Trek({
    quest:'orders',lit:[true,true,true],huntKills:3,watchKills:2,anchors:[true,true,true],seconds:310,
    field:{order:0,job:0,group:0,started:false,decoded:false,...field},
  })
}

const use = {x:0,z:0,interact:true}

test('the rune stone resets a wrong sequence and persists a solved one',()=>{
  const game=patrol({job:1})
  game.step(.04,use)
  assert(game.cipherOpen)
  assert(game.enterRune('T'))
  assert(!game.enterRune('S'))
  assert.equal(game.runeIndex,0)
  for(const rune of 'TRS') assert(game.enterRune(rune))
  const restored=new Trek(game.checkpoint)
  assert(restored.field.decoded)
  restored.step(.04,{x:0,z:0})
  assert(restored.enemiesAlive.length)
})

test('a delivered relic advances the journal only after interaction',()=>{
  const game=patrol({job:2,group:4,started:true})
  assert.equal(game.prompt,'Deliver the relic')
  game.step(.04,{x:0,z:0})
  assert(game.cargo)
  game.step(.04,use)
  assert(!game.cargo)
  assert.equal(new Trek(game.checkpoint).field.job,3)
})

test('scouts need a Heal at their post before the ambush',()=>{
  const game=patrol({order:6})
  game.step(.04,use)
  assert(game.needsMedic)
  assert.equal(game.enemiesAlive.length,0)
  game.step(.04,{x:0,z:0,skill:'heal'})
  assert(!game.needsMedic)
  assert(game.hero.spirit<100)
  assert(game.enemiesAlive.length)
  assert(new Trek(game.checkpoint).field.decoded)
})

test('encounter checkpoints restart just the remaining pack and finish the final order',()=>{
  const order=orders.length-1
  const job=orders[order].jobs.length-1
  const group=orders[order].jobs[job].groups.length-1
  const game=patrol({order,job,group,started:true})
  game.step(.04,{x:0,z:0})
  assert.equal(game.enemiesAlive.at(-1)?.title,'The Barrow King')
  const retry=new Trek(game.checkpoint)
  retry.step(.04,{x:0,z:0})
  assert.equal(retry.enemiesAlive.at(-1)?.title,'The Barrow King')
  for(const enemy of retry.enemiesAlive) enemy.hp=0
  retry.step(.04,{x:0,z:0})
  assert.equal(retry.quest,'dawn')
  assert.equal(new Trek(retry.checkpoint).quest,'dawn')
  assert(!validLog({...retry.field,group:99}))
})
