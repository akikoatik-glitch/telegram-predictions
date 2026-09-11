'use strict';
// Latin -> Arabic club names for the channel's biggest teams.
// Lookup is tolerant (strips FC/CF/SC/AFC suffixes, substring fallback).
// Unknown teams fall back to their Latin name — never blank, never guessed.
const NAMES = {
  'barcelona': 'برشلونة', 'real madrid': 'ريال مدريد', 'sevilla': 'إشبيلية',
  'atletico madrid': 'أتلتيكو مدريد', 'atletico': 'أتلتيكو مدريد', 'villarreal': 'فياريال',
  'real sociedad': 'ريال سوسيداد', 'athletic club': 'أتلتيك بلباو', 'athletic bilbao': 'أتلتيك بلباو',
  'real betis': 'ريال بيتيس', 'betis': 'ريال بيتيس', 'valencia': 'فالنسيا',
  'girona': 'جيرونا', 'getafe': 'خيتافي', 'osasuna': 'أوساسونا', 'celta': 'سيلتا',
  'arsenal': 'أرسنال', 'manchester city': 'مان سيتي', 'man city': 'مان سيتي',
  'liverpool': 'ليفربول', 'chelsea': 'تشيلسي', 'manchester united': 'مان يونايتد',
  'man united': 'مان يونايتد', 'tottenham': 'توتنهام', 'spurs': 'توتنهام',
  'newcastle': 'نيوكاسل', 'aston villa': 'أستون فيلا', 'everton': 'إيفرتون',
  'west ham': 'وست هام', 'brighton': 'برايتون', 'nottingham forest': 'نوتنغهام',
  'fulham': 'فولهام', 'leeds': 'ليدز', 'sunderland': 'سندرلاند',
  'inter': 'إنتر', 'internazionale': 'إنتر', 'ac milan': 'ميلان', 'milan': 'ميلان',
  'juventus': 'يوفنتوس', 'juve': 'يوفنتوس', 'napoli': 'نابولي', 'roma': 'روما',
  'lazio': 'لاتسيو', 'atalanta': 'أتالانتا', 'fiorentina': 'فيورنتينا',
  'bologna': 'بولونيا', 'torino': 'تورينو',
  'bayern': 'بايرن ميونخ', 'bayern munich': 'بايرن ميونخ', 'dortmund': 'دورتموند',
  'borussia dortmund': 'دورتموند', 'leipzig': 'لايبزيغ', 'leverkusen': 'ليفركوزن',
  'bayer leverkusen': 'ليفركوزن', 'stuttgart': 'شتوتغارت', 'schalke': 'شالكه',
  'psg': 'باريس', 'paris saint-germain': 'باريس', 'paris sg': 'باريس',
  'marseille': 'مارسيليا', 'monaco': 'موناكو', 'lyon': 'ليون', 'lille': 'ليل',
  'ajax': 'أياكس', 'psv': 'آيندهوفن', 'psv eindhoven': 'آيندهوفن',
  'feyenoord': 'فينورد', 'az alkmaar': 'ألكمار', 'utrecht': 'أوتريخت',
  'benfica': 'بنفيكا', 'porto': 'بورتو', 'sporting': 'سبورتينغ',
  'sporting cp': 'سبورتينغ', 'braga': 'براغا', 'sporting braga': 'براغا',
  'club brugge': 'كلوب بروج', 'brugge': 'كلوب بروج', 'anderlecht': 'أندرلخت',
  'genk': 'غينك', 'antwerp': 'أنتويرب', 'royal antwerp': 'أنتويرب',
  'standard liege': 'ستاندار لييج', 'gent': 'غينت', 'kaa gent': 'غينت',
  'galatasaray': 'غلطة سراي', 'fenerbahce': 'فنربخشة', 'besiktas': 'بشكتاش',
  'trabzonspor': 'طرابزون', 'basaksehir': 'باشاك شهير',
  'al hilal': 'الهلال', 'hilal': 'الهلال', 'al nassr': 'النصر', 'nassr': 'النصر',
  'al ahli': 'الأهلي', 'ahli': 'الأهلي', 'al ittihad': 'الاتحاد', 'ittihad': 'الاتحاد',
  'al ettifaq': 'الاتفاق', 'al shabab': 'الشباب', 'al fateh': 'الفتح',
  'celtic': 'سلتيك', 'rangers': 'رينجرز',
  'inter miami': 'إنتر ميامي', 'la galaxy': 'لا غالاكسي',
  'flamengo': 'فلامينغو', 'palmeiras': 'بالميراس', 'boca juniors': 'بوكا جونيورز',
  'river plate': 'ريفر بليت', 'ajax cape': 'أياكس',
};

function norm(s) {
  return String(s).toLowerCase()
    .replace(/\b(fc|cf|sc|afc|ac|ssc|us|as|rc|cd|ud|fk|sk|bk)\b\.?/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function arName(latin) {
  if (!latin) return latin;
  if (/[\u0600-\u06FF]/.test(latin)) return latin; // already Arabic
  const n = norm(latin);
  if (NAMES[n]) return NAMES[n];
  // longest substring fallback
  let best = null;
  for (const k of Object.keys(NAMES)) {
    if ((n.includes(k) || k.includes(n)) && (!best || k.length > best.length)) best = k;
  }
  return best ? NAMES[best] : latin;
}

module.exports = { arName, NAMES };
