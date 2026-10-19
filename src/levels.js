// ===============================================================
//  levels.js — ข้อมูลด่าน
//  แต่ละด่านเป็นตัวเลขล้วน ๆ ปรับความยาว เวลา เกณฑ์ดาว ความสูงเนิน ได้ที่นี่
//
//  theme     ฉาก: 'meadow' ทุ่งหญ้า, 'mine' เหมืองเปิด, 'cave' อุโมงค์ใต้ดิน, 'moon' ดวงจันทร์
//  length    ระยะจากจุดเริ่มถึงเส้นชัย (เมตร)
//  timeLimit เวลาที่มี (วินาที) หมดเวลา = แพ้
//  starTimes เวลาที่ต้องทำได้เพื่อได้ [2 ดาว, 3 ดาว] (วินาที)
//  gravity   แรงโน้มถ่วง (โลก = 10)
//  engineScale / antiWheelie  (ไม่ใส่ก็ได้) ปรับแรงเครื่องและการกดหน้ารถเฉพาะด่านนี้
//  seed      เลขสุ่มรูปร่างเนิน เปลี่ยนเลขนี้ = ได้เนินแบบใหม่
//  hills     spacing = ระยะห่างยอดเนิน, height = ความสูงเนิน ต้นด่าน→ท้ายด่าน,
//            rise = ทางชันขึ้น(+)/ลง(-) ต่อเมตร, maxSlope = ความชันสูงสุด,
//            bumps = ลูกระนาดเล็ก ๆ, steps = ทำเนินเป็นขั้นบันได (เมตร)
//  craters   หลุมอุกกาบาต: every = ระยะห่าง, width = กว้าง, depth = ลึก
//  ramps     ทางลาดกระโดด { x, length, height }
//  bridges   สะพาน { x, length, depth, type } type: 'wood' สะพานไม้ยวบได้, 'rail' รางรถเหมือง
//  boosts    แผ่นเร่งความเร็ว { x, length }
//  straights ทางตรงไว้ทำความเร็ว { x, length } (ไม่มีเนินในช่วงนี้)
//  fuelEvery มีถังน้ำมันทุก ๆ กี่เมตร
//  coinEvery มีกลุ่มเหรียญทุก ๆ กี่เมตร (โดยประมาณ)
// ===============================================================

export const LEVELS = [
  {
    id: 1,
    name: 'GREEN MEADOW',
    theme: 'meadow',
    length: 520,
    timeLimit: 130,
    starTimes: [72, 54],
    gravity: 10,
    seed: 7,
    hills: { spacing: [16, 28], height: [1.2, 5.0], rise: 0.012, maxSlope: 0.6, bumps: 0.12 },
    ramps: [
      { x: 92, length: 5, height: 1.2 },
      { x: 268, length: 6, height: 1.7 },
      { x: 410, length: 6, height: 2.0 },
    ],
    bridges: [],
    boosts: [],
    fuelEvery: 140,
    coinEvery: 34,
  },
  {
    id: 2,
    name: 'WINDY HILLS',
    theme: 'meadow',
    length: 640,
    timeLimit: 150,
    starTimes: [78, 60],
    gravity: 10,
    seed: 21,
    hills: { spacing: [14, 24], height: [2.0, 6.0], rise: 0.018, maxSlope: 0.62, bumps: 0.15 },
    ramps: [
      { x: 140, length: 6, height: 1.8 },
      { x: 470, length: 7, height: 2.2 },
    ],
    bridges: [
      { x: 290, length: 16, depth: 3.5, type: 'wood' },
      { x: 560, length: 14, depth: 3, type: 'wood' },
    ],
    boosts: [],
    fuelEvery: 160,
    coinEvery: 30,
  },
  {
    id: 3,
    name: 'OPEN PIT',
    theme: 'mine',
    length: 740,
    timeLimit: 130,
    starTimes: [80, 61],
    gravity: 10,
    seed: 33,
    hills: { spacing: [30, 46], height: [2.0, 5.5], rise: 0.015, maxSlope: 0.64, bumps: 0.05, steps: 2.4 },
    ramps: [{ x: 230, length: 6, height: 2.0 }],
    bridges: [
      { x: 380, length: 20, depth: 5, type: 'rail' },
      { x: 610, length: 16, depth: 4, type: 'rail' },
    ],
    boosts: [
      { x: 120, length: 4 },
      { x: 520, length: 4 },
    ],
    straights: [
      { x: 95, length: 65 },
      { x: 255, length: 85 },
      { x: 495, length: 95 },
      { x: 645, length: 60 },
    ],
    fuelEvery: 180,
    coinEvery: 32,
  },
  {
    id: 4,
    name: 'DEEP SHAFT',
    theme: 'cave',
    length: 800,
    timeLimit: 125,
    starTimes: [72, 58],
    gravity: 10,
    seed: 47,
    hills: { spacing: [26, 42], height: [2.0, 5.5], rise: -0.01, maxSlope: 0.66, bumps: 0.08 },
    ramps: [
      { x: 180, length: 6, height: 1.8 },
      { x: 640, length: 7, height: 2.2 },
    ],
    bridges: [
      { x: 300, length: 18, depth: 5, type: 'rail' },
      { x: 520, length: 22, depth: 6, type: 'rail' },
    ],
    boosts: [
      { x: 90, length: 4 },
      { x: 420, length: 4 },
      { x: 720, length: 4 },
    ],
    straights: [
      { x: 60, length: 90 },
      { x: 200, length: 80 },
      { x: 360, length: 120 },
      { x: 560, length: 70 },
      { x: 665, length: 95 },
    ],
    fuelEvery: 200,
    coinEvery: 30,
  },
  {
    id: 5,
    name: 'MOON BASE',
    theme: 'moon',
    length: 900,
    timeLimit: 210,
    starTimes: [108, 84],
    gravity: 4.5,
    antiWheelie: 0.85, // ดวงจันทร์แรงโน้มถ่วงน้อย รถยกล้อง่าย จึงช่วยกดหน้ารถมากกว่าปกติ
    seed: 59,
    hills: { spacing: [20, 36], height: [1.5, 6.0], rise: 0.02, maxSlope: 0.55, bumps: 0.03 },
    craters: { every: [26, 46], width: [8, 16], depth: [0.45, 0.9] },
    ramps: [
      { x: 160, length: 7, height: 2.4 },
      { x: 430, length: 8, height: 3.0 },
      { x: 720, length: 8, height: 3.2 },
    ],
    bridges: [],
    boosts: [
      { x: 300, length: 5 },
      { x: 600, length: 5 },
    ],
    fuelEvery: 180,
    coinEvery: 30,
  },
];
