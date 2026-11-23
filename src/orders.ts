// Each group is one encounter. The next group enters when the current one falls.
// H = hound, C = caster, W = stag, B = bull.
export type Post = 'hearth'|'orchard'|'kiln'|'ferry'|'shoal'|'arch'|'tower'|'quarry'|'copse'|'barrow'
export const posts = {
  hearth:{name:'Mira’s Hearth', x:1,z:20}, orchard:{name:'Old Orchard',x:-11,z:4},
  kiln:{name:'Clay Kiln',x:13,z:6}, ferry:{name:'Ferry Landing',x:-3,z:-6},
  shoal:{name:'Antler Stones',x:-4,z:-35}, arch:{name:'Stone Pass',x:-4,z:-52},
  tower:{name:'Signal Tower',x:3,z:-69}, quarry:{name:'East Quarry',x:13,z:-86},
  copse:{name:'Cinder Copse',x:-3,z:-84}, barrow:{name:'King’s Barrow',x:8,z:-101},
} as const
export type Assignment = {
  kind:'hunt'|'haul'|'ward'|'cipher'|'duel'|'rescue'
  name:string; post:Post; end?:Post; groups:string[]; runes?:string
}
const hunt=(name:string,post:Post,groups:string):Assignment=>({kind:'hunt',name,post,groups:groups.split(' ')})
const rescue=(name:string,post:Post,groups:string):Assignment=>({kind:'rescue',name,post,groups:groups.split(' ')})
const haul=(name:string,post:Post,end:Post,groups:string):Assignment=>({kind:'haul',name,post,end,groups:groups.split(' ')})
const ward=(name:string,post:Post,groups:string):Assignment=>({kind:'ward',name,post,groups:groups.split(' ')})
const cipher=(name:string,post:Post,runes:string,groups:string):Assignment=>({kind:'cipher',name,post,runes,groups:groups.split(' ')})
const duel=(name:string,post:Post,groups:string):Assignment=>({kind:'duel',name,post,groups:groups.split(' ')})
export const runeNames:Record<string,string>={S:'Sun',R:'Reed',T:'Tide'}
export const orders=[
  {title:'The Missing Ferryman', color:0xe6b978, story:'A torn sail hangs at the landing. Find the bell that guided the ferryman home.', jobs:[
    hunt('Search the empty skiffs','ferry','HH HC W HC'), cipher('Read the toll stone','shoal','TRS','C HH WC'),
    haul('Bring the brass bell home','ferry','hearth','HH C HC W'), ward('Keep the hearth alight','hearth','HC W CC HH WC'),
    duel('The Bell Thief','orchard','HC W CH B')]},
  {title:'Ash in the Grain',color:0xd9a35e,story:'Black dust is spreading from the kiln. Save the seed stores before the last kiln goes cold.',jobs:[
    haul('Move the seed chest','orchard','kiln','H HC WH C'), hunt('Track the ash pack','ferry','HH CC W HC'),
    ward('Hold the threshing floor','orchard','CH W HC CC WH'), cipher('Open the firebox','kiln','SRT','C HC WC'),
    duel('The Cinderhorn','kiln','W CC HC B')]},
  {title:'Letters from the Pass',color:0x96c7e4,story:'The watch lost contact with its scouts. Read their marks and get the dispatch across the bridge.',jobs:[
    cipher('Read the scout marks','arch','RTS','HC W CH'), hunt('Find the courier’s trail','tower','H CC WH HC'),
    haul('Carry the sealed dispatch','arch','ferry','CH HH C W'), ward('Cover the river runners','ferry','HC HH W CC WH'),
    duel('Grey Antler','shoal','CC WH CH W')]},
  {title:'The Quarry Debt',color:0xcc9392,story:'Cutters broke a ward under the quarry. Collect its fragments and close the fault.',jobs:[
    hunt('Clear the quarry lip','quarry','HH W CC WH'), haul('Carry the keystone','copse','quarry','HC W H CH'),
    cipher('Read the cutter’s tally','quarry','STR','CC H WC'), ward('Bind the broken fault','barrow','CH W HC CC WH'),
    duel('The Split Crown','quarry','HC WC H B')]},
  {title:'Lanterns in the Reedbed',color:0x8dc8ac,story:'False lights lead travellers into the water. Follow the lamp code and carry a true flame to the landing.',jobs:[
    ward('Guard the lampwright','hearth','HH C WH CC HC'), cipher('Read the lamp code','orchard','TSR','HC CC W'),
    haul('Bring the blue lantern','kiln','ferry','CC H HC W'), hunt('Trace the drowned lights','shoal','HH WC C WH'),
    duel('Keeper of False Lights','ferry','C WH CC B')]},
  {title:'A Price on the Watch',color:0xb7aadf,story:'The ash host has marked Mira’s post. Break its signals before its captain reaches the camp.',jobs:[
    hunt('Drive out the spotters','copse','CH CC W HH'), cipher('Decode the muster stones','tower','RST','C WH CC'),
    ward('Hold the stone pass','arch','HC WC HH CC W'), haul('Recover the watch standard','shoal','hearth','HH CH W C'),
    duel('The Ash Captain','orchard','CC WH HC B')]},
  {title:'The Field Hospital',color:0x93d6b6,story:'The last patrol came back without its medic. The chirurgeon needs a field dressing and two pairs of hands.',jobs:[
    rescue('Tend to the scout at the ford','ferry','HC CC W HH'), haul('Fetch the field dressings','hearth','shoal','CH WC HH W'),
    ward('Hold the surgeon’s tent','shoal','CC W HH WC CH'), rescue('Reach the missing medic','copse','WC HH CC WH'),
    duel('The Carrion Stag','arch','CH WC CC W')]},
  {title:'The Black Ledger',color:0xc1b6e5,story:'The rescued medic carried a list of prisoners. Follow its entries to the kiln and bring the witness out.',jobs:[
    cipher('Read the prisoner roll','arch','STRT','HC CC WH'), hunt('Follow the wagon ruts','kiln','HH WC HC W'),
    rescue('Free the kiln keeper','kiln','CC W HH WH'), haul('Carry the witness ledger','kiln','tower','WC HH HC W'),
    duel('The Toll Collector','tower','CC WH CH B')]},
  {title:'The Last Signal',color:0xffcc80,story:'Every signal now points to the barrow. Carry the dawn ember north and end the watch.',jobs:[
    haul('Take the dawn ember north','hearth','arch','HH WC HC W'), cipher('Speak the founding oath','arch','TRTS','CH W CC'),
    hunt('Cut off the rear guard','copse','HC WH CC W'), ward('Raise the final signal','tower','CC HH WC HC W'),
    duel('The Barrow King','barrow','WH CC WC B')]},
] as const
