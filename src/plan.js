const q = (en, zh, hint) => ({ en, zh, hint });
const lesson = (day,title,en,category,role,goal,questions,phrases) => ({day,title,en,category,role,goal,questions,phrases,week:Math.min(4,Math.ceil(day/7)),review:[7,14,21,28,30].includes(day)});
export const WEEKS = [
 {title:'先开口，再说完整', subtitle:'从一句话开始，认识彼此、聊聊生活。', icon:'sun'},
 {title:'把旅行里的需求说清楚', subtitle:'机场、酒店、餐厅，每次解决一个小问题。', icon:'plane'},
 {title:'卡住也能继续聊', subtitle:'听不懂可以问，安排有变也能说明白。', icon:'repeat'},
 {title:'换个情境，也能用出来', subtitle:'少一点提示，多一点真实的来回交流。', icon:'wave'}
];
export const PLAN = [
 lesson(1,'在旅行中，认识一个新朋友','A little hello goes a long way','生活','旅途中刚认识的朋友','留下第一份真实录音。每题一两句也可以，不提前背稿。',[
 q('Hi! Where are you from, and what do you like doing on holiday?','你来自哪里？度假时喜欢做什么？','来自哪里 → 一个爱好。可以从 I’m from… 开始。'),
 q('Tell me about one memorable trip. What did you enjoy?','说一次难忘的旅行，最喜欢什么？','地点 → 一件具体的事。先说完，再补原因。'),
 q('What would you like to do on your next trip?','下次旅行想做什么？','I’d like to… because…')
 ],['I’m from…','I really enjoy…','What about you?']),
 lesson(2,'用几句话，聊聊日常','Your everyday life','生活','新认识的朋友','说清你的日常活动，并补充一个简单原因。',[
 q('What do you usually do after work?','下班后通常做什么？','I usually… after work.'),q('What do you like about your weekends?','周末最喜欢什么？','一个活动 + because…'),q('Do you prefer a busy weekend or a quiet one?','喜欢忙碌还是安静的周末？','I prefer… because…')
 ],['I usually…','It helps me relax.','I prefer…']),
 lesson(3,'讲一次海边的经历','A day by the sea','潜水','喜欢海洋的旅伴','用先后顺序讲一段旅行或潜水见闻。不需要专业术语。',[
 q('When was the last time you went to the sea?','上次去海边是什么时候？','时间 + 地点。'),q('What did you see or do there?','你在那里看见或做了什么？','First… Then…'),q('How did you feel afterwards?','结束后感觉如何？','I felt… because…')
 ],['Last time, I…','The best part was…','I felt…']),
 lesson(4,'点一杯喜欢的饮品','Your usual coffee order','生活','咖啡店店员','说明饮品、大小和一项偏好。',[
 q('Hi! What would you like to drink?','你好，想喝点什么？','Could I have…?'),q('Would you like it hot or iced?','热的还是冰的？','I’d like it… please.'),q('Anything else for you today?','还需要其他东西吗？','加一项，或礼貌结束。')
 ],['Could I have…?','Less ice, please.','That’s all, thank you.']),
 lesson(5,'说出自己的旅行偏好','Your kind of holiday','旅行','一起计划出游的朋友','做一个选择，补充原因和例子。',[
 q('Would you rather go to the beach or explore a city?','更想去海边还是逛城市？','I’d rather…'),q('What makes that a good choice for you?','为什么适合你？','一个原因 + 一个例子。'),q('Would you plan every day or leave some time free?','每天排满还是留些空闲？','I like to… because…')
 ],['I’d rather…','For example,…','I like having time to…']),
 lesson(6,'把卡住的表达再说一次','Try it a different way','生活','耐心的陪练','先回放前几天的一段录音，再脱稿回答。',[
 q('Tell me a little about yourself and what you enjoy.','介绍一下自己和爱好。','别念旧稿，重新组织两句话。'),q('Why do you enjoy travelling?','为什么喜欢旅行？','一个原因就够了。'),q('What is one place you would recommend?','推荐一个地方。','地点 + 适合谁 + 原因。')
 ],['One thing I enjoy is…','I’d recommend…','Let me try again.']),
 lesson(7,'第一周：听见自己的起点','Your first weekly review','复盘','复盘伙伴','回听第一天；记录已经更顺的一件事和仍卡住的一件事。',[
 q('Where are you from, and what do you like doing on holiday?','再次介绍自己和度假爱好。','先不看第一天的答案。'),q('What do you usually do on a free afternoon?','有空的下午通常做什么？','新问题，用自己的话回答。')
 ],['This week, I…','I still find… difficult.']),
 lesson(8,'在机场，确认接下来的步骤','At the airport','旅行','机场工作人员','询问登机口、时间和方向；不使用真实证件信息。',[
 q('Hello! Where are you flying today?','你好，今天飞往哪里？','I’m flying to…'),q('Your gate has changed. What would you like to check?','登机口变了，你想确认什么？','问新登机口和方向。'),q('Is there anything else you need to know?','还有什么想知道的？','What time does boarding start?')
 ],['Where is gate…?','What time does…?','Could you show me the way?']),
 lesson(9,'顺利完成酒店入住','Checking in','旅行','酒店前台','说明预订，再确认早餐或入住时间。使用虚构姓名。',[
 q('Welcome! Do you have a reservation?','欢迎，请问有预订吗？','I have a reservation under…'),q('Your room will be ready in an hour. Is that okay?','房间一小时后准备好，可以吗？','确认能否寄存行李。'),q('Do you have any questions about your stay?','入住期间还有什么想问的？','早餐时间／退房时间。')
 ],['I have a reservation under…','Could I leave my luggage here?','Is breakfast included?']),
 lesson(10,'从这里，到想去的地方','Getting around','旅行','当地人或司机','确认目的地、路线和大致时间。',[
 q('Where would you like to go?','想去哪里？','目的地 + 附近地标。'),q('Would you prefer the faster route or the cheaper one?','更快还是更便宜的路线？','选择 + 原因。'),q('What would you like to check before we leave?','出发前想确认什么？','How long will it take?')
 ],['How can I get to…?','How long does it take?','Could you drop me off here?']),
 lesson(11,'看菜单，也说清偏好','At a restaurant','生活','餐厅服务员','点餐、询问食材、说明口味偏好。只做语言练习。',[
 q('Are you ready to order, or do you have a question?','可以点餐了吗，还是有问题想问？','询问一道菜里有什么。'),q('This dish is quite spicy. Would you still like it?','这道菜很辣，还想点吗？','Can you make it less spicy?'),q('Would you like something to drink with that?','需要配什么饮品？','饮品 + 礼貌结束。')
 ],['What’s in this dish?','Could you make it less spicy?','Could we have the bill, please?']),
 lesson(12,'预订一次海上活动','Booking an ocean activity','潜水','潜店预订工作人员','确认日期、集合地点、费用包含项。不是潜水安全教学。',[
 q('Hi! What activity would you like to book?','你好，想预订什么活动？','活动 + 日期。'),q('Which day works for you, and how many people are coming?','哪天合适，几个人？','日期 + 人数。'),q('What would you like to know before booking?','预订前有什么想确认？','集合时间、接送或包含项目。')
 ],['Is there a place available on…?','What’s included?','Where should we meet?']),
 lesson(13,'把一段旅行安排串起来','A small travel conversation','旅行','帮你安排活动的酒店工作人员','进行几轮问答；最后由你总结时间、地点和下一步。',[
 q('What would you like to do tomorrow afternoon?','明天下午想做什么？','一个活动 + 偏好。'),q('We have a morning option and an afternoon option. Which works?','上午和下午都可安排，哪个合适？','选择 + 一个限制。'),q('Could you tell me the plan we have agreed on?','请确认刚才商定的安排。','时间 → 地点 → 要准备的东西。')
 ],['That works for me.','Just to confirm,…','So we’ll meet at…']),
 lesson(14,'第二周：需求说清楚了吗','Your second weekly review','复盘','复盘伙伴','比较酒店或餐厅场景；看看是否能确认下一步。',[
 q('You have just arrived at a hotel. How would you introduce your booking?','刚到酒店，怎样说明预订？','不用背旧答案。'),q('You want to rent a bike for the afternoon. What would you ask?','下午想租自行车，会问什么？','新场景：时间、费用、归还地点。')
 ],['Could you confirm…?','Do I need to…?']),
 lesson(15,'没听懂，也能接着聊','Could you say that again?','生活','语速稍快的旅行伙伴','用英文请求重复、放慢，并确认理解。',[
 q('Let’s meet at the east entrance after lunch. What would you like to clarify?','午饭后在东入口见，有什么需要确认？','确认具体时间或哪个入口。'),q('I mean the entrance next to the small cafe. Is that clear?','是小咖啡店旁的入口，清楚了吗？','So you mean…?'),q('Could you repeat our meeting plan back to me?','请用自己的话复述见面安排。','地点 + 时间；不确定就再问。')
 ],['Could you say that again?','Could you speak a little more slowly?','Do you mean…?']),
 lesson(16,'选商品，而不是只说yes','Shopping with a preference','生活','商店店员','询问款式和大小，表达自己的选择。',[
 q('Can I help you find anything?','需要帮你找什么？','I’m looking for…'),q('We have this in blue and green. Which do you prefer?','有蓝色和绿色，更喜欢哪个？','选择 + 原因。'),q('Does this size work for you?','这个尺寸合适吗？','说明太大／太小并询问替代款。')
 ],['I’m looking for…','Do you have a smaller size?','I’ll think about it, thank you.']),
 lesson(17,'安排有变化，换一个方案','A change of plans','旅行','活动预订工作人员','说明限制，提出一个可接受的替代选项。',[
 q('I’m sorry, the afternoon tour is full. Would the morning work?','下午满了，上午可以吗？','说明自己的时间限制。'),q('We also have a place available the next day. How does that sound?','第二天还有位置，怎么样？','接受或提出其他日期。'),q('Could you confirm the new time with me?','请确认更改后的时间。','日期 + 时间 + 人数。')
 ],['Unfortunately, I can’t…','Is there another option?','Could we change it to…?']),
 lesson(18,'下雨了，下午怎么安排','A rainy afternoon','旅行','同行的朋友','表达不同意见，再提一个简单建议。',[
 q('It’s raining. Shall we cancel our afternoon plan?','下雨了，要取消下午的安排吗？','表达意见 + 原因。'),q('Would you rather visit a cafe or a museum?','咖啡店还是博物馆？','选择 + 适合现在的原因。'),q('How should we get there?','怎么过去？','一个交通方案。')
 ],['How about…?','I’d prefer…','That sounds good, but…']),
 lesson(19,'想不起单词，也能说明白','Describe it without the word','生活','帮你找物品的店员','用用途、外形和例子描述；不要求猜中标准词。',[
 q('You forgot the word for a phone charger. How would you describe it?','想不起充电器这个词，怎样描述？','It’s something you use to…'),q('Can you tell me what it looks like?','它看起来是什么样子？','大小、颜色或形状。'),q('Would a cable on its own solve your problem?','只有一条线能解决吗？','解释还需要什么。')
 ],['I don’t know the exact word, but…','It’s something you use to…','It looks like…']),
 lesson(20,'有一点意外的旅行对话','An unexpected situation','旅行','酒店前台','尝试不预先看后面的题；卡住时请求澄清。',[
 q('Welcome back. How was your day?','欢迎回来，今天怎么样？','一件经历 + 感受。'),q('Your airport pickup is now thirty minutes earlier. Is that a problem?','机场接送提前半小时，有问题吗？','说明是否方便，再确认时间。'),q('The meeting point has also changed. What would you like to ask?','集合地点也变了，想问什么？','问清地点和怎么找司机。')
 ],['Just to make sure,…','Could you explain…?','Let me put it another way.']),
 lesson(21,'第三周：卡住后，接得上吗','Your third weekly review','复盘','复盘伙伴','重点回听：有没有主动确认、换说法或提出替代方案。',[
 q('Your train is delayed. What would you ask the station staff?','火车晚点，会问工作人员什么？','预计时间 + 其他选择。'),q('You did not understand the answer. What would you say next?','没听懂对方回答，接下来怎么说？','直接用英文请求帮助。')
 ],['Could you explain that another way?','What are my options?']),
 lesson(22,'和新朋友自然地来回聊','A conversation, not a speech','生活','旅途中认识的新朋友','每题简短回答，也可以主动问对方一个问题。',[
 q('What brought you here on this trip?','这次为什么来这里？','原因 + What about you?'),q('What has been your favourite moment so far?','到目前最喜欢哪个瞬间？','一件具体的事。'),q('What are you hoping to do next?','接下来希望做什么？','一个计划，再问对方。')
 ],['What about you?','How has your trip been?','I’m hoping to…']),
 lesson(23,'买东西遇到小问题','A small problem with a purchase','生活','商店工作人员','说明问题、购买时间，以及想要的解决方式。',[
 q('Hello, how can I help?','你好，有什么能帮忙？','说明商品和问题，使用虚构信息。'),q('Would you prefer a replacement or a refund?','想换货还是退款？','选择 + 原因。'),q('Do you have your receipt with you?','带小票了吗？','根据情境回答，再问下一步。')
 ],['There seems to be a problem with…','I bought it…','Could I exchange it?']),
 lesson(24,'推荐一个不赶时间的下午','A relaxed afternoon','旅行','第一次来这里的朋友','根据对方反馈调整建议，不把行程排满。',[
 q('I have a free afternoon. What would you recommend?','有一下午空闲，你推荐什么？','一个地点 + 理由。'),q('I don’t want to walk too far. Would that still work?','不想走太远，还合适吗？','调整方案。'),q('Is there somewhere nearby to get a drink afterwards?','之后附近哪里能喝点东西？','再给一个简单建议。')
 ],['You might enjoy…','It’s not far from…','We could keep it simple.']),
 lesson(25,'礼貌地表达不同意见','A different idea','生活','同行的朋友','说清不同意见，并提供替代想法。',[
 q('Let’s start at six in the morning so we can do everything.','早上六点出发吧，就能玩遍了。','表达自己的偏好。'),q('Why would you prefer a later start?','为什么更想晚一点？','一个原因就可以。'),q('What plan would work for both of us?','什么安排能兼顾双方？','折中方案 + 确认。')
 ],['I see your point, but…','Could we… instead?','Would that work for you?']),
 lesson(26,'把一趟小出行聊完整','Plan a little adventure','旅行','一起出游的朋友','了解需求 → 给建议 → 处理变化 → 确认安排。',[
 q('Where would you like to go tomorrow?','明天想去哪里？','先给建议，也可问我的偏好。'),q('I only have three hours. Can we adjust the plan?','我只有三小时，可以调整吗？','保留最重要的一件事。'),q('What should we bring, and where should we meet?','带什么，在哪里集合？','物品 + 时间 + 地点。')
 ],['What do you feel like doing?','Let’s focus on…','Just to confirm our plan,…']),
 lesson(27,'只修最常卡住的两件事','A focused second try','生活','陪练','从录音档案挑两段，点击重练。也可以先答下面的问题。',[
 q('What travel experience would you like to tell me about?','想分享哪段旅行经历？','用你自己的例子，不念旧稿。'),q('What would you do differently next time?','下次有什么想换一种方式？','I would… because…'),q('Could you explain your main point in a simpler way?','能用更简单的话说重点吗？','保留意思，缩短句子。')
 ],['What I mean is…','Next time, I’d…']),
 lesson(28,'第四周：换题后，还能说吗','Your fourth weekly review','复盘','复盘伙伴','熟题和新题分开比较。不把重录的高分当成整体水平。',[
 q('Tell me about a trip you enjoyed and why you enjoyed it.','讲一次喜欢的旅行及原因。','熟题：换一个例子。'),q('You have one free evening in a new town. How would you choose what to do?','陌生小镇有一个空闲晚上，会怎样安排？','新题：想法 + 原因 + 一个问题。')
 ],['I’d start by…','The main reason is…']),
 lesson(29,'和第一天的自己，做个对比','Listen to how far you’ve come','复盘','测评伙伴','重复第一天前两题，再做新情境题。条件尽量保持一致。',[
 q('Hi! Where are you from, and what do you like doing on holiday?','你来自哪里？度假时喜欢做什么？','先不要看第1天录音和转写。'),
 q('Tell me about one memorable trip. What did you enjoy?','说一次难忘的旅行，最喜欢什么？','和第1天采用相同准备时间。'),
 q('Your room is too noisy, but the hotel is almost full. What would you ask?','房间太吵，酒店又快满了，你会怎样沟通？','新题：说明情况 + 一个可行的请求。')
 ],['Would it be possible to…?','Is there anything else we could try?']),
 lesson(30,'留下这一个月，继续下一段','Your next chapter','复盘','复盘伙伴','记录两项有录音证据的变化，选下周期重点。旧档案一直保留。',[
 q('Which situation feels easier to talk about now?','现在聊哪个场景更轻松？','举一个具体例子。'),q('What would you like to practise in your next learning cycle?','下个周期最想练什么？','选择一个最真实的需求。')
 ],['I’m getting better at…','I’d like to work on…'])
];
export const getLesson = day => PLAN.find(l => l.day === Number(day)) || PLAN[0];
export const routine = minutes => {
  const extra = Number(minutes) - 35;
  return [ ['开口热身',4,'回想昨天的一句话'], ['听一句，试一句',5,'先听问题，再用自己的话说'], ['情境来回聊',12,'每轮约10–30秒，不限一句话'], ['回听与重练',9+extra,'只修两三个关键问题'], ['留下一点记录',5,'保存录音和今天的发现'] ];
};
