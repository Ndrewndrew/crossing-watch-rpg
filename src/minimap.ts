import { anchorSites, beacons, bridge, bridgeX, isBoss, mira, passSite, river, roadX, watchSite, type Point, type Trek } from './world.ts'

const radius = 102
const scale = 4
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  draw(game: Trek, focus: Point) {
    const { ctx } = this
    const { hero } = game
    const x = (point: Point) => radius + (point.x - hero.x) * scale
    const z = (point: Point) => radius + (point.z - hero.z) * scale
    const dot = (point: Point, radius: number, fill: string) => {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(x(point), z(point), radius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = '#354936'
    ctx.fillRect(0, 0, radius * 2 + 4, radius * 2 + 4)
    ctx.fillStyle = '#5b574e'
    ctx.fillRect(0, 0, radius * 2 + 4, Math.max(0, z(passSite)))
    ctx.strokeStyle = '#8aa1a06b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(radius, radius, radius * .48, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    for (const side of [-1, 1]) {
      const from = hero.x - side * (radius / scale + 2)
      for (let i = 0; i <= 34; i++) {
        const currentX = from + side * i * (radius / scale + 2) / 17
        const edge = { x: currentX, z: river(currentX) + side * 3.5 }
        if (i === 0 && side === -1) ctx.moveTo(x(edge), z(edge))
        else ctx.lineTo(x(edge), z(edge))
      }
    }
    ctx.closePath()
    ctx.fillStyle = '#3c7180'
    ctx.fill()

    ctx.beginPath()
    for (let i = 0; i <= 56; i++) {
      const north = hero.z - (radius / scale + 2) + i * (radius / scale + 2) / 28
      const road = { x: roadX(north), z: north }
      ctx.lineTo(x(road), z(road))
    }
    ctx.strokeStyle = '#b597656e'
    ctx.lineWidth = 9
    ctx.stroke()
    const deck = { x: bridgeX, z: bridge.min }
    ctx.fillStyle = game.opened ? '#d1ac78' : '#8e8163'
    ctx.fillRect(x(deck) - bridge.halfWidth*scale, z(deck), bridge.halfWidth*2*scale, (bridge.max-bridge.min)*scale)

    dot(mira, 4, '#c1ddbb')
    dot(watchSite, 4, game.chapter >= 2 && game.quest !== 'pass' ? '#ffc770' : '#a29a88')
    if (game.quest === 'light') {
      for (const [index, beacon] of beacons.entries()) dot(beacon, 3.4, game.lit[index] ? '#96936c' : '#efcf82')
    }
    if (game.quest === 'anchors') {
      for (const [index, anchor] of anchorSites.entries()) dot(anchor, 3.4, game.anchors[index] ? '#8e9690' : '#dfa3fd')
    }
    for (const enemy of game.enemiesAlive) dot(enemy, isBoss(enemy.kind) ? 6 : 3.8, '#f2a282')

    const dx = x(focus) - radius
    const dz = z(focus) - radius
    const limit = Math.max(1, Math.hypot(dx, dz) / 84)
    ctx.save()
    ctx.translate(radius + dx / limit, radius + dz / limit)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#ffe5a0'
    ctx.fillRect(-4, -4, 8, 8)
    ctx.restore()

    ctx.save()
    ctx.translate(radius, radius)
    ctx.rotate(Math.PI - hero.yaw)
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(6, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(-6, 6)
    ctx.closePath()
    ctx.strokeStyle = '#17252b'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#ebf7df'
    ctx.fill()
    ctx.restore()
  }
}
