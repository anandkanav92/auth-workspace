import type { Chapter } from "@/types/chapter";

export const chapter16: Chapter = {
  id: 16,
  title: "Naar de bioscoop",
  theme: "Going to the cinema, buying a ticket, asking about films, conjunctions (en, of, maar, want, dus)",
  dialogue: {
    lines: [
      { speaker: "Amira", dutch: "Goedenavond, mag ik een kaartje voor Alles is liefde?", english: "Good evening, may I have a ticket for Alles is liefde?" },
      { speaker: "Caissière", dutch: "Voor wanneer wilt u reserveren?", english: "For when would you like to book?" },
      { speaker: "Amira", dutch: "Nee, ik wil niet reserveren. Ik wil graag een kaartje voor vandaag, voor de voorstelling van 20.15 uur.", english: "No, I don't want to book. I'd like a ticket for today, for the 8.15 pm show." },
      { speaker: "Caissière", dutch: "Het spijt me, maar Alles is liefde is al om 19.45 uur begonnen. U mag nog wel naar binnen.", english: "I'm sorry, but Alles is liefde already started at 7.45 pm. You may still go in." },
      { speaker: "Amira", dutch: "Wat stom. Ik heb verkeerd gekeken, denk ik. Het is nu, even kijken, 20.00 uur, dus de film is al een kwartier bezig. Nee, dat wil ik niet want ik heb het begin gemist, dat vind ik niet leuk. Draaien er nog andere films?", english: "How stupid. I looked at it wrong, I think. It's now, let me see, 8 pm, so the film has been going for a quarter of an hour. No, I don't want that because I've missed the beginning, I don't like that. Are there other films showing?" },
      { speaker: "Caissière", dutch: "Eh, ja hoor. Om 20.45 uur draait Zomerhitte en om 21.30 uur De Nieuwe Wildernis. Eerder niet.", english: "Eh, yes sure. At 8.45 pm Zomerhitte is showing and at 9.30 pm De Nieuwe Wildernis. Not earlier." },
      { speaker: "Amira", dutch: "Hm, ze zeggen me allebei niets.", english: "Hm, neither of them means anything to me." },
      { speaker: "Caissière", dutch: "Zomerhitte is een Nederlandse film. Hij is op Texel opgenomen, naar een verhaal van Jan Wolkers, en De Nieuwe Wildernis is een natuurdocumentaire. Hij draait al heel lang, iedereen vindt hem erg mooi.", english: "Zomerhitte is a Dutch film. It was filmed on Texel, based on a story by Jan Wolkers, and De Nieuwe Wildernis is a nature documentary. It's been showing for a very long time, everyone finds it very beautiful." },
      { speaker: "Amira", dutch: "Zijn de films Nederlands gesproken of hebben ze ondertiteling?", english: "Are the films spoken in Dutch or do they have subtitles?" },
      { speaker: "Caissière", dutch: "Zomerhitte en De Nieuwe Wildernis zijn beide Nederlands gesproken en dus niet ondertiteld.", english: "Zomerhitte and De Nieuwe Wildernis are both spoken in Dutch and therefore not subtitled." },
      { speaker: "Amira", dutch: "Hoelang duurt Zomerhitte?", english: "How long is Zomerhitte?" },
      { speaker: "Caissière", dutch: "Bijna 100 minuten, zonder pauze.", english: "Almost 100 minutes, without an interval." },
      { speaker: "Amira", dutch: "Dan een kaartje voor Zomerhitte, eerste rang graag.", english: "Then a ticket for Zomerhitte, first class please." },
      { speaker: "Caissière", dutch: "We hebben geen rangen, alles is hier eerste rang. Dat is dan € 9,-.", english: "We don't have classes, everything here is first class. That'll be € 9." },
      { speaker: "Amira", dutch: "Alstublieft.", english: "Here you go." },
      { speaker: "Caissière", dutch: "Dit is uw kaartje. Veel plezier.", english: "This is your ticket. Enjoy!" },
    ],
  },
  vocabulary: [
    { dutch: "de caissière", english: "box office assistant / cashier", category: "noun" },
    { dutch: "reserveren", english: "book / reserve", category: "verb" },
    { dutch: "de voorstelling", english: "show / session", category: "noun" },
    { dutch: "wat stom", english: "how stupid", category: "phrase" },
    { dutch: "verkeerd", english: "wrong", category: "adjective" },
    { dutch: "gekeken (kijken)", english: "looked", category: "verb" },
    { dutch: "is al bezig", english: "has started / is underway", category: "phrase" },
    { dutch: "het begin", english: "beginning", category: "noun" },
    { dutch: "gemist (missen)", english: "missed", category: "verb" },
    { dutch: "draaien", english: "are showing", category: "verb" },
    { dutch: "de zomer", english: "summer", category: "noun" },
    { dutch: "de hitte", english: "heat", category: "noun" },
    { dutch: "eerder", english: "earlier", category: "adverb" },
    { dutch: "opgenomen (opnemen)", english: "filmed / recorded", category: "verb" },
    { dutch: "naar een verhaal van", english: "based on a story by", category: "phrase" },
    { dutch: "het verhaal", english: "story", category: "noun" },
    { dutch: "de natuurdocumentaire", english: "nature documentary", category: "noun" },
    { dutch: "de documentaire", english: "documentary", category: "noun" },
    { dutch: "gesproken (spreken)", english: "spoken", category: "verb" },
    { dutch: "de ondertiteling", english: "subtitles", category: "noun" },
    { dutch: "ondertiteld (ondertitelen)", english: "subtitled", category: "verb" },
    { dutch: "bijna", english: "almost", category: "adverb" },
    { dutch: "de rang", english: "class (seating)", category: "noun" },
    { dutch: "het kwartier", english: "quarter of an hour", category: "noun" },
    { dutch: "de pauze", english: "interval / break", category: "noun" },
    { dutch: "veel plezier", english: "enjoy / have fun", category: "phrase" },
  ],
  grammar: [
    {
      topic: "Conjunctions: en, of, maar, want, dus",
      explanation: `These five little words connect two main clauses (hoofdzin + hoofdzin) -- and the great news is: the word order STAYS NORMAL after them. No verb gymnastics!

  en (and):    Zomerhitte is Nederlands gesproken EN De Nieuwe Wildernis is ook niet ondertiteld.
  of (or):     Zijn de films Nederlands gesproken OF hebben ze ondertiteling?
  maar (but):  Het spijt me MAAR Alles is liefde is al om 19.45 uur begonnen.
  want (because): Nee, dat wil ik niet WANT ik heb het begin gemist.
  dus (so):    Het is nu 20.00 uur DUS de film is al een kwartier bezig.

Each conjunction has its own logic: en adds, of offers a choice, maar contrasts, want gives a reason, dus draws a conclusion.`,
      tips: [
        "These five are the EASY conjunctions: subject and verb keep their normal order after them. 'Ik blijf thuis, want ik ben moe' -- not 'want ik moe ben'.",
        "'Want' (because) gives the reason AFTER the fact: 'Ik ga niet, want ik heb het begin gemist.'",
        "'Dus' (so) draws the conclusion: 'Jij bent student, dus je krijgt korting.' Cause first, conclusion after.",
        "Test yourself: want and dus are mirror images. 'Het regent, dus ik blijf thuis' = 'Ik blijf thuis, want het regent.'",
      ],
      table: {
        headers: ["Conjunction", "Meaning", "Example"],
        rows: [
          ["en", "and", "Mijn zus is getrouwd en ze woont nu in Peru."],
          ["of", "or", "Je kunt een kaartje kopen bij de automaat of je kunt het online kopen."],
          ["maar", "but", "Ik wil u graag helpen, maar ik ben hier ook niet bekend."],
          ["want", "because", "Je hoeft niet met de bus, want de bioscoop is dichtbij."],
          ["dus", "so", "Jij bent student, dus je krijgt korting."],
        ],
      },
      examples: [
        { dutch: "Het wiel staat scheef en de rem doet het niet goed.", english: "The wheel is crooked and the brake isn't working well.", note: "en = and" },
        { dutch: "Wil je dit broodje of wil je dat broodje?", english: "Do you want this roll or do you want that roll?", note: "of = or" },
        { dutch: "Het spijt me, maar de film is al begonnen.", english: "I'm sorry, but the film has already started.", note: "maar = but" },
        { dutch: "Dat wil ik niet, want ik heb het begin gemist.", english: "I don't want that, because I've missed the beginning.", note: "want = because" },
        { dutch: "Het is een Nederlandse film, dus je moet goed luisteren en opletten.", english: "It's a Dutch film, so you have to listen carefully and pay attention.", note: "dus = so" },
      ],
    },
    {
      topic: "Buying a cinema ticket (een kaartje kopen)",
      explanation: `The cinema transaction has a fixed script:

  Mag ik een kaartje voor ...? (May I have a ticket for ...?)
  Voor wanneer wilt u reserveren? (For when would you like to book?)
  Ik wil graag een kaartje voor de voorstelling van 20.15 uur.
  (I'd like a ticket for the 8.15 pm show.)
  Dat is dan € 9,-. (That'll be € 9.)
  Dit is uw kaartje. Veel plezier! (This is your ticket. Enjoy!)

And when things go wrong:
  Het spijt me, maar de film is al begonnen. (I'm sorry, but the film has already started.)
  De film is al een kwartier bezig. (The film has been going for 15 minutes.)
  Ik heb het begin gemist. (I've missed the beginning.)`,
      tips: [
        "'De voorstelling van 20.15 uur' -- Dutch cinemas use the 24-hour clock. 20.15 uur = 8.15 pm.",
        "'Bezig zijn' = to be underway: 'De film is al een kwartier bezig' (The film started 15 minutes ago). Also for people: 'Ik ben bezig' (I'm busy with something).",
        "'Wat stom!' (How stupid!) is what you say about your own mistakes -- like misreading the start time. Self-deprecating and very Dutch.",
        "'Veel plezier!' (Have fun / Enjoy!) is the universal send-off for any fun activity -- cinema, party, holiday.",
      ],
      examples: [
        { dutch: "Mag ik een kaartje voor Alles is liefde?", english: "May I have a ticket for Alles is liefde?" },
        { dutch: "Ik wil graag een kaartje voor de voorstelling van 20.15 uur.", english: "I'd like a ticket for the 8.15 pm show." },
        { dutch: "Het spijt me, maar de film is al om 19.45 uur begonnen.", english: "I'm sorry, but the film already started at 7.45 pm." },
        { dutch: "Wat stom. Ik heb verkeerd gekeken, denk ik.", english: "How stupid. I looked at it wrong, I think." },
        { dutch: "Dat is dan € 9,-. -- Alstublieft.", english: "That'll be € 9. -- Here you go." },
      ],
    },
    {
      topic: "Asking about films: draaien, duren, ondertiteling",
      explanation: `Useful questions for choosing a film:

  Draaien er nog andere films? (Are there other films showing?)
  Hoelang duurt de film? (How long is the film?)
  Zijn de films Nederlands gesproken of hebben ze ondertiteling?
  (Are the films spoken in Dutch or do they have subtitles?)

Films 'draaien' (run/show) in the cinema: 'Om 20.45 uur draait Zomerhitte.' A long-running film 'draait al heel lang'.

And a wonderful idiom from the dialogue: 'Ze zeggen me allebei niets' -- literally 'they both say nothing to me' = neither of them rings a bell / means anything to me.`,
      tips: [
        "'Draaien' is the cinema verb: 'Welke films draaien er deze week?' (Which films are showing this week?)",
        "'Hoelang duurt ...?' works for anything with a duration: a film, a lesson, a trip. 'Bijna 100 minuten, zonder pauze.'",
        "'Nederlands gesproken' vs 'ondertiteld': Dutch films have no subtitles, so as a learner check before you book! Foreign films in the Netherlands keep their original language with Dutch subtitles.",
        "'Dat zegt me niets' (that means nothing to me / doesn't ring a bell) -- a handy idiom when you don't know a name or title.",
      ],
      examples: [
        { dutch: "Draaien er nog andere films?", english: "Are there other films showing?" },
        { dutch: "Hoelang duurt Zomerhitte? -- Bijna 100 minuten, zonder pauze.", english: "How long is Zomerhitte? -- Almost 100 minutes, without an interval." },
        { dutch: "Zijn de films Nederlands gesproken of hebben ze ondertiteling?", english: "Are the films spoken in Dutch or do they have subtitles?" },
        { dutch: "Ze zeggen me allebei niets.", english: "Neither of them means anything to me.", note: "idiom: dat zegt me niets" },
        { dutch: "Hij is op Texel opgenomen, naar een verhaal van Jan Wolkers.", english: "It was filmed on Texel, based on a story by Jan Wolkers." },
      ],
    },
  ],
  exercises: [
    {
      type: "fill_blank",
      prompt: "Je kunt een kaartje kopen bij de automaat ___ je kunt het online kopen.",
      answer: "of",
      hint: "Conjunction: a choice between two options",
    },
    {
      type: "fill_blank",
      prompt: "Het is een Nederlandse film ___ je moet goed luisteren en opletten.",
      answer: "dus",
      hint: "Conjunction: drawing a conclusion",
    },
    {
      type: "fill_blank",
      prompt: "Ik wil u graag helpen ___ ik ben hier helaas ook niet bekend.",
      answer: "maar",
      hint: "Conjunction: contrast",
    },
    {
      type: "fill_blank",
      prompt: "Nee, dat wil ik niet ___ ik heb het begin gemist.",
      answer: "want",
      hint: "Conjunction: giving a reason",
    },
    {
      type: "fill_blank",
      prompt: "Mijn zus is getrouwd ___ ze woont nu in Peru.",
      answer: "en",
      hint: "Conjunction: adding information",
    },
    {
      type: "fill_blank",
      prompt: "Hoelang ___ Zomerhitte? -- Bijna 100 minuten.",
      answer: "duurt",
      hint: "Asking about duration",
    },
    {
      type: "multiple_choice",
      question: "Je hoeft niet met de bus te gaan ___ de bioscoop is hier dichtbij.",
      options: ["want", "dus", "of", "en"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "Studenten krijgen tien procent korting. Jij bent student, ___ je krijgt korting.",
      options: ["dus", "want", "maar", "of"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "'De film is al een kwartier bezig' means:",
      options: ["The film started a quarter of an hour ago", "The film lasts a quarter of an hour", "The film starts in fifteen minutes", "The film has an interval of fifteen minutes"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "Wat betekent 'ondertiteld'?",
      options: ["subtitled", "dubbed", "spoken", "recorded"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "Which Kijkwijzer rating means a film is suitable for all ages?",
      options: ["AL", "6", "12", "16"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "'Ze zeggen me allebei niets' means:",
      options: ["Neither of them means anything to me", "They both say nothing", "They are both silent films", "I can't hear either of them"],
      correctIndex: 0,
    },
    {
      type: "translate",
      dutch: "Mag ik een kaartje voor de voorstelling van 20.15 uur?",
      english: "May I have a ticket for the 8.15 pm show?",
      direction: "nl_to_en",
    },
    {
      type: "translate",
      dutch: "Zijn de films Nederlands gesproken of hebben ze ondertiteling?",
      english: "Are the films spoken in Dutch or do they have subtitles?",
      direction: "nl_to_en",
    },
    {
      type: "translate",
      dutch: "Het spijt me, maar de film is al begonnen.",
      english: "I'm sorry, but the film has already started.",
      direction: "nl_to_en",
    },
    {
      type: "word_order",
      shuffled: ["wil", "niet", "Ik", "reserveren"],
      correct: "Ik wil niet reserveren",
    },
    {
      type: "word_order",
      shuffled: ["duurt", "Hoelang", "film", "de"],
      correct: "Hoelang duurt de film",
    },
    {
      type: "word_order",
      shuffled: ["is", "kaartje", "Dit", "uw"],
      correct: "Dit is uw kaartje",
    },
  ],
  pronunciation: {
    focus: "-ig and -lijk: two endings that hide a sjwa",
    tips: [
      "The ending '-ig' is pronounced 'uhg' (sjwa + soft g), NOT 'ich': bezig = BAY-zuhg, gelukkig = ge-LUK-kuhg, prachtig = PRACH-tuhg.",
      "The ending '-lijk' is pronounced 'luhk' (sjwa, no 'eye' sound!): belachelijk = be-LACH-uh-luhk, natuurlijk = na-TUUR-luhk, moeilijk = MOEI-luhk.",
      "These endings are NEVER stressed. The classic learner mistake is saying 'moei-LIJK' with a clear ij -- it's always a lazy 'luk'.",
      "Drill the most frequent ones until automatic: natuurlijk, eigenlijk, makkelijk, moeilijk, heerlijk, duidelijk -- and gelukkig, belangrijk, prachtig, veilig.",
    ],
    practiceWords: [
      { word: "bezig" },
      { word: "gelukkig" },
      { word: "veilig" },
      { word: "handig" },
      { word: "jarig" },
      { word: "prachtig" },
      { word: "toevallig" },
      { word: "weinig" },
      { word: "zonnig" },
      { word: "belachelijk" },
      { word: "duidelijk" },
      { word: "smakelijk" },
      { word: "eigenlijk" },
      { word: "heerlijk" },
      { word: "gemakkelijk" },
      { word: "moeilijk" },
      { word: "natuurlijk" },
      { word: "mogelijk" },
    ],
  },
  culture: {
    topic: "Kijkwijzer en de Nederlandse bioscoop",
    content: "Before you take children to a Dutch cinema (or let them watch TV), you'll meet Kijkwijzer: the national content rating system. It gives every film and programme an age rating -- AL (alle leeftijden, all ages), 6, 9, 12 or 16 -- plus pictograms explaining WHY: geweld (violence), angst (fear), seks, discriminatie, drugs- en alcoholgebruik (drug and alcohol use) and grof taalgebruik (coarse language). Important Dutch nuance: Kijkwijzer says nothing about quality -- 'ouders zijn zelf verantwoordelijk' (parents are responsible themselves). For language learners, Dutch cinema is a gift: foreign films are never dubbed, only subtitled, so you can read Dutch subtitles while listening to English -- free study material! Dutch films like 'Zomerhitte' (filmed on the island of Texel, based on a story by the famous writer Jan Wolkers) and the hit nature documentary 'De Nieuwe Wildernis' (about the Oostvaardersplassen nature reserve) are spoken in Dutch without subtitles -- a real test of your listening skills. One more pleasant surprise from the dialogue: most Dutch cinemas abolished seating classes long ago. 'We hebben geen rangen, alles is hier eerste rang' -- everything is first class!",
  },
};
