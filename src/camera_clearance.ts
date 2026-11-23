import { floor, type Point } from './world.ts'

export type CameraPoint = Point & { y: number }
export type CameraObstacle = Point & { base: number; top: number; radius: number; box?: {x:number;z:number;yaw:number} }

export function touchesFootprint(p:Point, obstacle:CameraObstacle, padding:number) {
  const dx=p.x-obstacle.x, dz=p.z-obstacle.z
  if (!obstacle.box) return dx*dx+dz*dz < (obstacle.radius+padding)**2
  const {x,z,yaw}=obstacle.box
  const c=Math.cos(yaw), s=Math.sin(yaw)
  return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-x),Math.max(0,Math.abs(s*dx+c*dz)-z)) < padding
}

const clearance = .24

export function clearCameraFraction(pivot: CameraPoint, eye: CameraPoint, obstacles: readonly CameraObstacle[]) {
  const dx = eye.x - pivot.x, dy = eye.y - pivot.y, dz = eye.z - pivot.z
  const length = Math.hypot(dx, dy, dz)
  if (length < .001) return 1
  const horizontal = Math.hypot(dx, dz) || 1
  const sideX = dz / horizontal * clearance, sideZ = -dx / horizontal * clearance
  const nearby = obstacles.filter(o => Math.hypot(o.x - pivot.x, o.z - pivot.z) < length + o.radius + clearance)
  const steps = Math.ceil(length / .14)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = pivot.x + dx * t, y = pivot.y + dy * t, z = pivot.z + dz * t
    if (y - clearance < Math.max(floor(x, z), floor(x + sideX, z + sideZ), floor(x - sideX, z - sideZ))
      || nearby.some(o => y + clearance > o.base && y - clearance < o.top && touchesFootprint({x,z},o,clearance))) {
      return (i - 1) / steps
    }
  }
  return 1
}
