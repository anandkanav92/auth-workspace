import type { Chapter } from "@/types/chapter";

export const chapter4: Chapter = {
  id: 4,
  title: "Op straat",
  theme: "Meeting friends, asking how someone is doing, making plans, proposals with zullen, positive and negative responses",
  dialogue: {
    lines: [
      { speaker: "Narrator", dutch: "De ober, Bert, komt op straat zijn vriend Hans tegen.", english: "The waiter, Bert, runs into his friend Hans on the street." },
      { speaker: "Bert", dutch: "He Hans, hallo!", english: "Hey Hans, hello!" },
      { speaker: "Hans", dutch: "He Bert, hoi. Dat is lang geleden, zeg. Wat leuk! Alles goed?", english: "Hey Bert, hi. It's been a long time. How nice! Everything okay?" },
      { speaker: "Bert", dutch: "Ja, prima. En met jou, hoe is het met jou?", english: "Yes, great. And with you, how are you?" },
      { speaker: "Hans", dutch: "Het gaat wel. Ik heb problemen met de buren, maar dat is nu niet zo belangrijk. Ik heb vakantie en Wilma en ik gaan deze week een paar dagen naar Venetie.", english: "I'm doing alright. I have problems with the neighbours, but that's not so important now. I'm on holiday and Wilma and I are going to Venice for a few days this week." },
      { speaker: "Bert", dutch: "Wauw! Venetie is prachtig. Ga je veel foto's maken?", english: "Wow! Venice is splendid. Are you going to take a lot of photos?" },
      { speaker: "Hans", dutch: "Nee, we hebben sinds gisteren een nieuwe camera, dus we gaan een romantische film maken. Kom je na de vakantie naar de film kijken?", english: "No, we've had a new camera since yesterday, so we're going to make a romantic film. Will you come watch the film after the holiday?" },
      { speaker: "Bert", dutch: "Ja, leuk. Zullen we direct iets afspreken?", english: "Yes, nice. Shall we set a date right now?" },
      { speaker: "Hans", dutch: "Goed. We zijn op vrijdag weer thuis. Zullen we voor zaterdag een afspraak maken?", english: "Good. We'll be home again on Friday. Shall we make a date for Saturday?" },
      { speaker: "Bert", dutch: "Welke datum is het dan?", english: "What date is that then?" },
      { speaker: "Hans", dutch: "De 29ste.", english: "The 29th." },
      { speaker: "Bert", dutch: "Nee, dat lukt niet. Dan heb ik al een afspraak. Zondag 30 augustus kan ik wel.", english: "No, that doesn't work. I already have an appointment then. Sunday August 30th works for me." },
      { speaker: "Hans", dutch: "Dat kan ook. Zullen we om 16.00 uur bij ons thuis afspreken? Blijf je ook eten? Zal ik dan spaghetti carbonara maken?", english: "That works too. Shall we meet at our place at 4 PM? Will you stay for dinner? Shall I make spaghetti carbonara?" },
      { speaker: "Bert", dutch: "Ja, lekker. Goed plan. Ik schrijf het straks in mijn agenda. Hartstikke leuk.", english: "Yes, delicious. Good plan. I'll write it in my diary later. Really great." },
      { speaker: "Hans", dutch: "Ja, vind ik ook.", english: "Yes, I think so too." },
      { speaker: "Bert", dutch: "Ik moet ervandoor. Ik moet nog gauw even naar de winkel. Ik wens jullie een fijne vakantie. Doe de groeten aan Wilma en tot volgende week zondag.", english: "I have to go. I still need to quickly pop to the shop. I wish you a nice holiday. Give my regards to Wilma and see you next week Sunday." },
      { speaker: "Hans", dutch: "Doe ik. Tot dan. Doeg.", english: "Will do. Until then. Bye." },
    ],
  },
  vocabulary: [
    { dutch: "de straat", english: "street", category: "noun" },
    { dutch: "de vriend", english: "friend", category: "noun" },
    { dutch: "komt tegen (tegenkomen)", english: "meets / runs into", category: "verb" },
    { dutch: "he", english: "hey", category: "greeting" },
    { dutch: "geleden", english: "ago", category: "adverb" },
    { dutch: "leuk", english: "nice / fun", category: "adjective" },
    { dutch: "prima", english: "wonderful / great", category: "adjective" },
    { dutch: "jou", english: "you (object form)", category: "pronoun" },
    { dutch: "het gaat wel", english: "I'm doing all right", category: "phrase" },
    { dutch: "problemen (het probleem)", english: "problems", category: "noun" },
    { dutch: "de buren", english: "neighbours", category: "noun" },
    { dutch: "niet zo", english: "not so", category: "adverb" },
    { dutch: "belangrijk", english: "important", category: "adjective" },
    { dutch: "gaan", english: "go", category: "verb" },
    { dutch: "de week", english: "week", category: "noun" },
    { dutch: "een paar dagen (dag)", english: "a few days", category: "phrase" },
    { dutch: "Venetie", english: "Venice", category: "noun" },
    { dutch: "wauw", english: "wow", category: "basic" },
    { dutch: "prachtig", english: "fine / splendid", category: "adjective" },
    { dutch: "veel", english: "many / a lot", category: "adverb" },
    { dutch: "foto's maken", english: "take photos", category: "verb" },
    { dutch: "sinds", english: "since", category: "preposition" },
    { dutch: "nieuw", english: "new", category: "adjective" },
    { dutch: "de camera", english: "camera", category: "noun" },
    { dutch: "romantische (romantisch)", english: "romantic", category: "adjective" },
    { dutch: "de film", english: "film", category: "noun" },
    { dutch: "na", english: "after", category: "preposition" },
    { dutch: "kijken naar", english: "look at / watch", category: "verb" },
    { dutch: "direct", english: "right now / immediately", category: "adverb" },
    { dutch: "iets", english: "something", category: "pronoun" },
    { dutch: "afspreken", english: "set a date / make an appointment", category: "verb" },
    { dutch: "goed", english: "okay / good", category: "adjective" },
    { dutch: "thuis", english: "at home", category: "adverb" },
    { dutch: "de afspraak", english: "date / appointment", category: "noun" },
    { dutch: "maken", english: "to make", category: "verb" },
    { dutch: "de datum", english: "date (calendar)", category: "noun" },
    { dutch: "dat lukt niet (lukken)", english: "that doesn't work", category: "phrase" },
    { dutch: "dan", english: "then", category: "adverb" },
    { dutch: "kan (kunnen)", english: "can", category: "verb" },
    { dutch: "blijf (blijven)", english: "stay", category: "verb" },
    { dutch: "eten", english: "eat", category: "verb" },
    { dutch: "zal (zullen)", english: "will / shall", category: "verb" },
    { dutch: "de spaghetti carbonara", english: "spaghetti carbonara", category: "noun" },
    { dutch: "het plan", english: "plan", category: "noun" },
    { dutch: "schrijf (schrijven)", english: "write", category: "verb" },
    { dutch: "de agenda", english: "diary / planner", category: "noun" },
    { dutch: "hartstikke", english: "very / completely", category: "adverb" },
    { dutch: "hartstikke leuk", english: "terrific / fantastic", category: "phrase" },
    { dutch: "vind ik ook (vinden)", english: "I think so too", category: "phrase" },
    { dutch: "ik moet ervandoor", english: "I have to go / I'm off", category: "phrase" },
    { dutch: "ervandoor", english: "away / off", category: "adverb" },
    { dutch: "gauw", english: "quickly", category: "adverb" },
    { dutch: "de winkel", english: "shop", category: "noun" },
    { dutch: "wens (wensen)", english: "wish", category: "verb" },
    { dutch: "jullie", english: "you (plural)", category: "pronoun" },
    { dutch: "fijne (fijn)", english: "nice / good", category: "adjective" },
    { dutch: "doe de groeten aan", english: "give my regards to", category: "phrase" },
    { dutch: "volgende", english: "next", category: "adjective" },
    { dutch: "tot dan", english: "until then", category: "greeting" },
    { dutch: "doeg", english: "bye (informal)", category: "greeting" },
  ],
  grammar: [
    {
      topic: "Asking and telling how you're doing (Hoe gaat het?)",
      explanation: `One of the first things you'll need in any Dutch conversation is asking someone how they're doing. Dutch has a few standard phrases for this, and the responses range from super positive to not-so-great.

The key phrases to ask are:
  - "Alles goed?" (Everything okay?) — casual, between friends
  - "Hoe gaat het (met jou)?" — the standard "How are you?" (informal)
  - "Hoe is het (met u)?" — same thing but more formal

Notice that "met jou" (with you, informal) becomes "met u" (with you, formal) — same pattern as chapter 1's jij/u distinction.`,
      tips: [
        "In daily Dutch life, 'Alles goed?' is probably the most common greeting between friends. It's like 'You alright?' in British English — you don't need a long answer.",
        "The responses follow a scale from very positive (++) to negative (-). Memorize 2-3 that match your personality: 'Prima!' if you're upbeat, 'Goed' for neutral, 'Het gaat wel' for so-so.",
        "'Het gaat wel' literally means 'it goes well' but actually signals 'I'm okay-ish' — it's the Dutch understatement. If someone says this, they might want to talk about what's bothering them.",
        "WATCH OUT: 'Hartstikke goed' is super enthusiastic — like saying 'Absolutely fantastic!' Use it when you really mean it, or it sounds sarcastic.",
      ],
      table: {
        headers: ["Level", "Dutch response", "English meaning"],
        rows: [
          ["++", "Prima!", "Wonderful!"],
          ["++", "Fantastisch!", "Fantastic!"],
          ["++", "Uitstekend!", "Excellent!"],
          ["++", "Heel goed!", "Very good!"],
          ["++", "Hartstikke goed!", "Really great!"],
          ["+", "Goed.", "Good."],
          ["+/-", "Het gaat wel.", "It's alright / so-so."],
          ["+/-", "Niet zo (goed).", "Not so (good)."],
          ["-", "Niet goed.", "Not good."],
          ["-", "Slecht.", "Bad."],
        ],
      },
      examples: [
        { dutch: "Alles goed?", english: "Everything okay?", note: "Casual greeting between friends" },
        { dutch: "Hoe gaat het met jou?", english: "How are you? (informal)", note: "The standard way to ask" },
        { dutch: "Hoe is het met u?", english: "How are you? (formal)", note: "Use with strangers, older people" },
        { dutch: "Ja, prima. En met jou?", english: "Yes, great. And with you?", note: "Classic response + bounce the question back" },
        { dutch: "Het gaat wel.", english: "I'm doing alright.", note: "Signals 'okay but not amazing'" },
      ],
    },
    {
      topic: "Zullen (shall/will) — making proposals and suggestions",
      explanation: `'Zullen' is the Dutch equivalent of 'shall' in English — it's THE verb for making suggestions and proposals. When you want to suggest doing something together, 'zullen' is your go-to word.

The pattern is simple:
  Zullen + we/wij + infinitive verb (at the end)?
  "Zullen we iets afspreken?" = "Shall we set a date?"

For "I shall" (offering to do something yourself), use "zal ik":
  "Zal ik spaghetti carbonara maken?" = "Shall I make spaghetti carbonara?"

The conjugation is straightforward:`,
      tips: [
        "'Zullen we...' is how Dutch people suggest plans. It's softer than 'We gaan...' (We're going to...) because it asks for agreement. Think of it as 'Shall we...?' in English.",
        "'Zal ik...' is for offering to do something: 'Zal ik koffie maken?' (Shall I make coffee?). It's polite and helpful — use it a lot!",
        "The main verb always goes to the END of the sentence when you use zullen. This is a key Dutch grammar rule: 'Zullen we voor zaterdag een afspraak MAKEN?' The making goes last!",
        "Don't confuse 'zullen' (suggesting) with 'willen' (wanting). 'Zullen we gaan?' = 'Shall we go?' (gentle suggestion). 'Wil je gaan?' = 'Do you want to go?' (direct question).",
      ],
      table: {
        headers: ["Pronoun", "zullen (shall/will)"],
        rows: [
          ["ik", "zal"],
          ["jij", "zal (also: zul)"],
          ["u", "zal (also: zult)"],
          ["hij/zij/het", "zal"],
          ["wij", "zullen"],
          ["jullie", "zullen"],
          ["zij (they)", "zullen"],
        ],
      },
      examples: [
        { dutch: "Zullen we iets afspreken?", english: "Shall we set a date?", note: "Suggesting a plan together" },
        { dutch: "Zullen we voor zaterdag een afspraak maken?", english: "Shall we make a date for Saturday?", note: "Notice: 'maken' goes to the end!" },
        { dutch: "Zullen we om 16.00 uur bij ons thuis afspreken?", english: "Shall we meet at our place at 4 PM?" },
        { dutch: "Zal ik dan spaghetti carbonara maken?", english: "Shall I make spaghetti carbonara then?", note: "'Zal ik' = offering to do something yourself" },
      ],
    },
    {
      topic: "Making appointments and responding positively or negatively",
      explanation: `Making plans is a huge part of social life, and Dutch has clear patterns for inviting someone and for accepting or declining. The key phrases for suggesting a meeting are:

  "Zullen we voor zaterdag een afspraak maken?" (Shall we make a date for Saturday?)
  "Zullen we iets afspreken?" (Shall we arrange something?)

Then the other person responds positively or negatively. Learn these responses as fixed phrases — they'll become automatic quickly.`,
      tips: [
        "Positive responses: 'Ja, dat kan.' (Yes, that works.) and 'Ja, dat is goed.' (Yes, that's good.) are the most versatile — they work for any invitation.",
        "Negative responses always start with 'Nee' and then give a reason. 'Nee, dat lukt niet.' (No, that doesn't work.) is polite and doesn't require a detailed excuse.",
        "'Nee, ik heb al een afspraak.' (No, I already have an appointment.) is the classic Dutch way to decline — straightforward and honest, no drama.",
        "When declining, Dutch people often suggest an alternative immediately: 'Nee, dat lukt niet. Maar zondag kan ik wel.' (No, that doesn't work. But Sunday works for me.) This keeps the conversation going.",
      ],
      table: {
        headers: ["Type", "Dutch", "English"],
        rows: [
          ["+ Positive", "Ja, dat kan.", "Yes, that works."],
          ["+ Positive", "Ja, dat is goed.", "Yes, that's good."],
          ["- Negative", "Nee, dat lukt niet.", "No, that doesn't work."],
          ["- Negative", "Nee, ik heb al een afspraak.", "No, I already have an appointment."],
          ["- Negative", "Nee, dan kan ik niet.", "No, I can't then."],
        ],
      },
      examples: [
        { dutch: "Zullen we voor zaterdag een afspraak maken?", english: "Shall we make a date for Saturday?", note: "Proposing a day" },
        { dutch: "Ja, dat kan. Zullen we om 16.00 uur afspreken?", english: "Yes, that works. Shall we meet at 4 PM?", note: "Accepting + suggesting a time" },
        { dutch: "Nee, dat lukt niet. Dan heb ik al een afspraak.", english: "No, that doesn't work. I already have an appointment then.", note: "Declining with a reason" },
        { dutch: "Zondag 30 augustus kan ik wel.", english: "Sunday August 30th works for me.", note: "Offering an alternative" },
      ],
    },
    {
      topic: "Asking someone to do something together (Ga je mee? / Heb je zin om...?)",
      explanation: `Beyond 'zullen we', there are two more casual ways to invite someone to do something with you:

  "Ga je mee (naar)...?" = "Will you come along (to)...?"
  "Heb je zin om...?" = "Do you feel like...?" / "Are you up for...?"

These are more informal than 'zullen we' and feel more like friendly invitations. The responses can be positive or negative, using a similar pattern to appointment-making.`,
      tips: [
        "'Ga je mee?' is super common in everyday Dutch. Kids use it, adults use it, everyone uses it. It literally means 'Go you along?' Think of it as 'Wanna come?'",
        "'Heb je zin om...' is followed by 'te + infinitive': 'Heb je zin om naar de film te kijken?' (Do you feel like watching the film?). The 'te' before the verb is like English 'to'.",
        "Positive replies: 'Ja, leuk!' (Yes, fun!), 'Ja, goed idee.' (Yes, good idea.) — short and enthusiastic.",
        "Negative replies: 'Nee, ik kan niet.' (No, I can't.), 'Nee, dat vind ik niet zo leuk.' (No, I don't really like that.), 'Nee, ik heb geen zin.' (No, I don't feel like it.) — Dutch people appreciate honesty!",
      ],
      table: {
        headers: ["Type", "Dutch", "English"],
        rows: [
          ["Asking", "Ga je mee (naar)...?", "Will you come along (to)...?"],
          ["Asking", "Heb je zin om...?", "Do you feel like...?"],
          ["+ Positive", "Ja, leuk.", "Yes, fun / nice."],
          ["+ Positive", "Ja, goed idee.", "Yes, good idea."],
          ["- Negative", "Nee, ik kan niet.", "No, I can't."],
          ["- Negative", "Nee, dat vind ik niet zo leuk.", "No, I don't really like that."],
          ["- Negative", "Nee, ik heb geen zin.", "No, I don't feel like it."],
        ],
      },
      examples: [
        { dutch: "Kom je na de vakantie naar de film kijken?", english: "Will you come watch the film after the holiday?", note: "Inviting someone to do something" },
        { dutch: "Ga je mee naar de bioscoop?", english: "Will you come along to the cinema?", note: "Casual invitation" },
        { dutch: "Heb je zin om naar de kantine te gaan?", english: "Do you feel like going to the canteen?", note: "'te' before infinitive" },
        { dutch: "Ja, leuk!", english: "Yes, fun!", note: "Enthusiastic positive response" },
        { dutch: "Nee, ik heb geen zin.", english: "No, I don't feel like it.", note: "Honest negative response" },
      ],
    },
    {
      topic: "Time expressions: talking about when things happen",
      explanation: `Chapter 4 introduces several time-related words and phrases that are essential for making plans. Dutch uses a mix of specific dates, days, and relative time expressions.

The key patterns are:
  - "deze week" = this week
  - "volgende week" = next week
  - "voor zaterdag" = for Saturday
  - "om 16.00 uur" = at 4 PM
  - "op vrijdag" = on Friday
  - "sinds gisteren" = since yesterday`,
      tips: [
        "Dutch uses 'om' for clock times: 'om 16.00 uur' (at 4 PM). Think of 'om' as 'at' for times. English says 'at 4', Dutch says 'om 4'.",
        "For days of the week, Dutch uses 'op': 'op vrijdag' (on Friday). But in casual speech, people often drop the 'op': 'We zijn vrijdag weer thuis.' (We'll be home Friday.)",
        "'Sinds' (since) is useful for time references: 'sinds gisteren' (since yesterday). It works just like English 'since'.",
        "Dates in Dutch use ordinal numbers: 'de 29ste' (the 29th). You add '-ste' to numbers from 1-19 and '-ste' to 20+. So: 'de eerste' (1st), 'de tweede' (2nd), 'de derde' (3rd), then from 4 onwards: 'de vierde', 'de vijfde'... 'de twintigste' (20th), 'de eenendertigste' (31st).",
      ],
      examples: [
        { dutch: "We gaan deze week naar Venetie.", english: "We're going to Venice this week." },
        { dutch: "We zijn op vrijdag weer thuis.", english: "We'll be home again on Friday.", note: "'op' + day of the week" },
        { dutch: "Zullen we om 16.00 uur afspreken?", english: "Shall we meet at 4 PM?", note: "'om' + time" },
        { dutch: "Welke datum is het dan?", english: "What date is that then?" },
        { dutch: "Tot volgende week zondag.", english: "See you next week Sunday.", note: "'volgende' = next" },
      ],
    },
    {
      topic: "Useful social phrases: greetings, wishes, and goodbyes",
      explanation: `Chapter 4 is packed with natural social phrases that Dutch people use in everyday conversation. These aren't grammar rules so much as chunks of language you should memorize as complete units.

These phrases make you sound natural and friendly — way more important than perfect grammar at this stage!`,
      tips: [
        "'Doe de groeten aan...' (Give my regards to...) is a warm way to end a conversation. It shows you care about the other person's family/friends. Very Dutch!",
        "'Ik moet ervandoor' (I have to go / I'm off) is THE way to signal you need to leave. More natural than 'Ik moet gaan.' It literally means 'I must away-from-there' — quirky but very common.",
        "'Dat is lang geleden' (That's been a long time ago) is what you say when bumping into someone you haven't seen in ages. Perfect opening line!",
        "'Vind ik ook' (I think so too) — notice the word order! Not 'Ik vind ook' but 'Vind ik ook'. The verb comes first because the implied 'dat' (that) is in first position. Don't worry about why, just memorize the phrase.",
      ],
      examples: [
        { dutch: "Dat is lang geleden, zeg.", english: "It's been a long time.", note: "'zeg' adds emphasis, like 'I must say'" },
        { dutch: "Wat leuk!", english: "How nice!", note: "Exclamation of pleasant surprise" },
        { dutch: "Vind ik ook.", english: "I think so too.", note: "Agreeing with someone" },
        { dutch: "Ik moet ervandoor.", english: "I have to go.", note: "Signaling you need to leave" },
        { dutch: "Doe de groeten aan Wilma.", english: "Give my regards to Wilma.", note: "Warm goodbye phrase" },
        { dutch: "Ik wens jullie een fijne vakantie.", english: "I wish you a nice holiday.", note: "Wishing someone well" },
        { dutch: "Doe ik. Tot dan. Doeg.", english: "Will do. Until then. Bye.", note: "Quick, friendly farewell" },
      ],
    },
  ],
  exercises: [
    {
      type: "fill_blank",
      prompt: "Hoe gaat het ___ jou?",
      answer: "met",
      hint: "preposition meaning 'with'",
    },
    {
      type: "fill_blank",
      prompt: "___ we voor zaterdag een afspraak maken?",
      answer: "Zullen",
      hint: "the verb for 'shall' (we-form)",
    },
    {
      type: "fill_blank",
      prompt: "Nee, dat ___ niet. Dan heb ik al een afspraak.",
      answer: "lukt",
      hint: "verb meaning 'works out' (from lukken)",
    },
    {
      type: "fill_blank",
      prompt: "___ ik dan spaghetti carbonara maken?",
      answer: "Zal",
      hint: "the verb for 'shall' (ik-form)",
    },
    {
      type: "fill_blank",
      prompt: "Doe de ___ aan Wilma en tot volgende week.",
      answer: "groeten",
      hint: "noun meaning 'regards'",
    },
    {
      type: "fill_blank",
      prompt: "Dat is lang ___, zeg. Wat leuk!",
      answer: "geleden",
      hint: "word meaning 'ago'",
    },
    {
      type: "multiple_choice",
      question: "How do you respond positively to 'Zullen we zaterdag afspreken?'",
      options: ["Ja, dat kan.", "Nee, dat lukt niet.", "Het gaat wel.", "Ik moet ervandoor."],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "What does 'Hoe gaat het met jou?' mean?",
      options: ["How are you? (informal)", "Where are you going?", "What are you doing?", "How are you? (formal)"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "Which is the correct 'ik' form of 'zullen'?",
      options: ["zal", "zullen", "zul", "zult"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "What does 'Ik moet ervandoor' mean?",
      options: ["I have to go / I'm off", "I must eat something", "I'm going there", "I have to do it"],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "How would you say 'That doesn't work' when declining a proposal?",
      options: ["Dat lukt niet.", "Dat kan wel.", "Dat is goed.", "Dat vind ik leuk."],
      correctIndex: 0,
    },
    {
      type: "multiple_choice",
      question: "What is 'hartstikke leuk' in English?",
      options: ["Really great / terrific", "A little nice", "Not so good", "Quite okay"],
      correctIndex: 0,
    },
    {
      type: "translate",
      dutch: "Zullen we iets afspreken?",
      english: "Shall we set a date?",
      direction: "nl_to_en",
    },
    {
      type: "translate",
      dutch: "Doe de groeten aan Wilma.",
      english: "Give my regards to Wilma.",
      direction: "nl_to_en",
    },
    {
      type: "translate",
      dutch: "Het gaat wel.",
      english: "I'm doing alright.",
      direction: "nl_to_en",
    },
    {
      type: "word_order",
      shuffled: ["we", "voor", "Zullen", "een", "maken", "afspraak", "zaterdag"],
      correct: "Zullen we voor zaterdag een afspraak maken",
    },
    {
      type: "word_order",
      shuffled: ["het", "gaat", "Hoe", "jou", "met"],
      correct: "Hoe gaat het met jou",
    },
    {
      type: "word_order",
      shuffled: ["ik", "ervandoor", "moet"],
      correct: "Ik moet ervandoor",
    },
  ],
  pronunciation: {
    focus: "Uitspraak: e - ee",
    tips: [
      "Dutch has two 'e' sounds that English speakers often confuse: the short 'e' (as in 'bed') and the long 'ee' (like the 'ay' in English 'day' but without the glide).",
      "Short 'e' appears in closed syllables (syllables ending in a consonant): 'wel', 'verder', 'hebben', 'lekker'. It sounds like the 'e' in English 'pet'.",
      "Long 'ee' appears in open syllables or when written double: 'week', 'idee', 'probleem'. It sounds like a pure 'ay' without the 'y' glide at the end.",
      "A good test: if you can hold the vowel sound steady, it's the long 'ee'. If it feels short and clipped, it's the short 'e'. Practice: 'wel' (short) vs 'week' (long).",
    ],
    practiceWords: [
      { word: "wel", pronunciation: "short e (like 'pet')" },
      { word: "verder", pronunciation: "short e" },
      { word: "hebben", pronunciation: "short e" },
      { word: "lekker", pronunciation: "short e" },
      { word: "week", pronunciation: "long ee (like 'way')" },
      { word: "idee", pronunciation: "long ee" },
      { word: "probleem", pronunciation: "long ee" },
      { word: "hetzelfde", pronunciation: "short e" },
      { word: "moment", pronunciation: "short e" },
      { word: "wensen", pronunciation: "short e" },
      { word: "prettig", pronunciation: "short e" },
      { word: "tekst", pronunciation: "short e" },
    ],
  },
  culture: {
    topic: "Afspraken maken: Making appointments in the Netherlands",
    content: "Dutch people are famously organized when it comes to social appointments. Unlike many cultures where you might drop by someone's house unannounced, in the Netherlands you almost always make an appointment first -- even with close friends and family. The Dutch use diaries (agendas) religiously to schedule social visits, coffee dates, and dinners. If you suggest meeting 'sometime', a Dutch person will typically want to set a specific date and time right away. This chapter's dialogue is a perfect example: Bert and Hans immediately pick a day, time, and even what they'll eat. Don't be surprised if Dutch friends say 'Nee, dat lukt niet' (No, that doesn't work) -- they're not being rude, just honest. They'll usually suggest an alternative date. Spontaneous visits are becoming more common among younger people, but the appointment culture remains strong.",
  },
};
