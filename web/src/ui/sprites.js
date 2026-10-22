// Tiny pixel sprites drawn as character grids; '.' is transparent.
export const PALETTE = {
  k: '#4a2f1a', r: '#c8423a', b: '#8a2a1f', w: '#f4efe4', y: '#f2c84b', g: '#5c8a3a',
  s: '#c9c2b6', o: '#e08a3c', p: '#f2b33d', c: '#a0683a', l: '#9cc4e4',
};

export const SPRITES = {
  pot: ['............', '....kkkk....', '..kkrrrrkk..', '.krrbrrbrrk.', '.krrrrrrrrk.', 'kkwwwwwwwwkk', '.kwwwwwwwwk.', '..kkkkkkkk..'],
  bowl: ['..s..s..s...', '...s..s..s..', '..s..s..s...', 'kkkkkkkkkkkk', 'kyyyggyyyyyk', '.kwwwwwwwwk.', '..kwwwwwwk..', '...kkkkkk...'],
  tomato: ['....gg......', '...gg.......', '..rrrrrr....', '.rrrrrrrr...', '.rrwrrryyy..', '.rrrrryyyyy.', '..rrrrryyy..', '...rrrr.....'],
  hat: ['..kkkkkkkk..', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', '.kwwwwwwwwk.', '..kwwwwwwk..', '..kkkkkkkk..', '..kwwwwwwk..', '..kkkkkkkk..'],
  cart: ['k...........', 'kk..........', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kwwwwwwk..', '..kkkkkkkk..', '..k......k..', '..kk....kk..'],
  basket: ['....kkkk....', '...k....k...', '..k......k..', 'kkkkkkkkkkkk', 'kcckcckcckck', '.kcckcckcck.', '.kckkckkckk.', '..kkkkkkkk..'],
  fridge: ['kkkkkkkk', 'kwwwwwwk', 'kwwwwwlk', 'kwwwwwwk', 'kkkkkkkk', 'kwwwwwwk', 'kwwwwwlk', 'kwwwwwwk', 'kwwwwwwk', 'kkkkkkkk'],
  star: ['....p....', '....p....', '...ppp...', 'ppppppppp', '.ppppppp.', '..ppppp..', '..pp.pp..', '.pp...pp.', 'p.......p'],
  cat: ['..o.o.........', '.ooooo........', '.okoko..ooooo.', '.ooooooooooooo', '..oooooooooooo', '...kk.kk...ooo'],
  leaf: ['......gg', '....gggg', '..gggggg', '.ggggggk', 'gggggkg.', 'gggkgg..', 'gkgg....', 'k.......'],
  egg: ['..wwww..', '.wwwwww.', 'wwwyywww', 'wwyyyyww', 'wwyyyyww', 'wwwyywww', '.wwwwww.', '..wwww..'],
  fish: ['.....lll....', '...lllllll.l', '.llkllllllll', 'llllllllllll', '.lllllllllll', '...lllllll.l', '.....lll....'],
};
