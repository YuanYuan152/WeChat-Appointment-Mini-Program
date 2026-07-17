# -*- coding: utf-8 -*-
"""Generate assessment JSON from tables/常见量表 reference documents."""
import json
from pathlib import Path

OUT_PRO = Path(__file__).resolve().parent.parent / "src" / "data" / "assessments-professional.json"
OUT_FUN = Path(__file__).resolve().parent.parent / "src" / "data" / "assessments-fun.json"

BSI_OPTIONS = [
    {"text": "无", "value": 1},
    {"text": "轻度", "value": 2},
    {"text": "中度", "value": 3},
    {"text": "比较重", "value": 4},
    {"text": "严重", "value": 5},
]

BSI_ITEMS = [
    "头晕或晕倒",
    "对事物不感兴趣",
    "神经过敏，心中不踏实",
    "胸痛",
    "感到孤独",
    "感到紧张或容易紧张",
    "恶心或胃部不舒服",
    "感到苦闷",
    "无缘无故地突然感到害怕",
    "呼吸有困难",
    "感到自己没有什么价值",
    "一阵阵恐惧或惊恐",
    "身体发麻或刺痛",
    "感到没有前途没有希望",
    "感到坐立不安心神不定",
    "感到身体的某一部分软弱无力",
    "想结束自己的生命",
    "感到害怕",
]

LIKERT_5 = [
    {"text": "完全不符合", "value": 1},
    {"text": "较不符合", "value": 2},
    {"text": "不能确定", "value": 3},
    {"text": "较符合", "value": 4},
    {"text": "完全符合", "value": 5},
]

AAS_ITEMS = [
    "我发现与人亲近比较容易。",
    "我发现要我去依赖别人很困难。",
    "我时常担心情侣并不真心爱我。",
    "我发现别人并不愿像我希望的那样亲近我。",
    "能依赖别人让我感到很舒服。",
    "我不在乎别人太亲近我。",
    "我发现当我需要别人帮助时，没人会帮我。",
    "和别人亲近使我感到有些不舒服。",
    "我时常担心情侣不想和我呆在一起。",
    "当我对别人表达我的情感时，我害怕他们与我的感觉会不一样。",
    "我时常怀疑情侣是否真正关心我。",
    "我对与别人建立亲密的关系感到很舒服。",
    "当有人在情感上太亲近我时，我感到不自在。",
    "我知道当我需要别人帮助时，总有人会帮我。",
    "我想与人亲近，但担心自己会受到伤害。",
    "我发现我很难完全依赖别人。",
    "情侣想要我在情感上更亲近一些，这常使我感到不舒服。",
    "我不能肯定，在我需要时，总能找到可以依赖的人。",
]

PBI_MOTHER = [
    "用温和友好的语气与我说话",
    "没有给我足够的帮助",
    "允许我做自己喜欢的事情",
    "情感上显得对我冷淡",
    "了解我的问题与担忧",
    "对我很疼爱",
    "喜欢让我自己拿主意",
    "不想我长大",
    "试图控制我做的每一件事",
    "侵犯我的隐私",
    "经常对我微笑",
    "似乎不明白我需要什么和想要什么",
    "让我决定自己的事情",
    "让我觉得自己是可有可无的",
    "在我心烦意乱的时候可以让我心情好起来",
    "不经常与我交谈",
    "试图让我觉得我离不开她",
    "觉得没有她在身边我就不能照顾好自己",
    "给我足够自由",
    "允许我自由外出",
    "对我保护过度",
    "从不夸奖我",
    "允许我随心所欲地选择穿着",
]

PBI_FATHER = [
    "用温和友好的语气与我说话",
    "没有给我足够的帮助",
    "允许我做自己喜欢的事情",
    "情感上显得对我冷淡",
    "了解我的问题与担忧",
    "对我很疼爱",
    "喜欢让我自己拿主意",
    "不想我长大",
    "试图控制我做的每一件事",
    "侵犯我的隐私",
    "喜欢与我商量事情",
    "经常对我微笑",
    "似乎不明白我需要什么和想要什么",
    "让我决定自己的事情",
    "在我心烦意乱的时候可以让我心情好起来",
    "不经常与我交谈",
    "试图让我觉得我离不开他",
    "觉得没有他在身边我就不能照顾好自己",
    "给我足够自由",
    "允许我自由外出",
    "对我保护过度",
    "从不夸奖我",
    "允许我随心所欲地选择穿着",
]

PBI_OPTIONS = [
    {"text": "非常不符合", "value": 0},
    {"text": "比较不符合", "value": 1},
    {"text": "比较符合", "value": 2},
    {"text": "非常符合", "value": 3},
]

CBCL_ITEMS = [
    "行为幼稚与其年龄不符",
    "过敏性症状（如起疹、发痒等）",
    "喜欢争论",
    "哮喘病",
    "举动像异性",
    "随地大便",
    "喜欢吹牛或自夸",
    "精神不能集中，注意力不能持久",
    "老是想某些事情，不能摆脱，强迫观念",
    "坐立不安活动过多",
    "喜欢缠着大人或过分依赖",
    "常说感到寂寞",
    "胡里胡涂，如在云里雾中",
    "常常哭叫",
    "虐待动物",
    "虐待、欺侮别人或吝啬",
    "好做白日梦或发呆、幻想",
    "故意伤害自己或企图自杀",
    "需要别人经常注意自己",
    "破坏自己的东西",
    "破坏家里或其他儿童的东西",
    "在家不听话",
    "在学校不听话",
    "不肯好好吃饭",
    "不与其他儿童相处",
    "有不良行为后不感到内疚",
    "易嫉妒",
    "吃不能作为食物的东西",
    "除怕上学外，还害怕某些动物、情景或地方",
    "怕上学",
    "怕自己想坏念头或做坏事",
    "觉得自己必须十全十美",
    "觉得或抱怨没有人喜欢自己",
    "觉得有人要害自己",
    "觉得自己无用或有自卑感",
    "经常弄伤自己，容易出事故",
    "经常打架",
    "常被人戏弄",
    "经常和容易遇到麻烦的儿童呆在一起",
    "听到某些实际上没有的声音",
    "冲动或行为粗鲁",
    "喜欢孤独",
    "撒谎或欺骗",
    "咬指甲",
    "神经过敏，容易激动或紧张",
    "动作紧张或带有抽动性",
    "做恶梦",
    "不被其他儿童喜欢",
    "便秘",
    "过度恐惧或担心",
    "感到头昏",
    "过份内疚",
    "吃得过多",
    "过份疲劳",
    "身体过重",
    "找不到原因的躯体症状：疼痛",
    "找不到原因的躯体症状：头痛",
    "找不到原因的躯体症状：恶心想吐",
    "找不到原因的躯体症状：眼睛有问题",
    "找不到原因的躯体症状：发疹或其他皮肤病",
    "找不到原因的躯体症状：腹部疼痛或绞痛",
    "找不到原因的躯体症状：呕吐",
    "找不到原因的躯体症状：其他",
    "对别人身体进行攻击",
    "挖鼻孔、皮肤或身体其他部分",
    "公开玩弄自己的生殖器",
    "过多地玩弄自己的生殖器",
    "功课差",
    "动作不灵活",
    "喜欢和年龄较大的儿童在一起",
    "喜欢和年龄较小的儿童在一起",
    "不肯说话",
    "不断重复某些动作，强迫行为",
    "离家出走",
    "经常尖叫",
    "守口如瓶，有事不说出来",
    "看到某些实际上没有的东西",
    "行为不自然或容易感到为难",
    "玩火",
    "性方面的问题",
    "夸耀自己或胡闹",
    "害羞或胆小",
    "比大多数孩子睡得少",
    "比大多数孩子睡得多",
    "玩弄粪便",
    "言语问题",
    "茫然或者凝视一点",
    "在家偷东西",
    "在外偷东西",
    "收藏自己不需要的东西",
    "怪异行为",
    "怪异想法",
    "固执、绷着脸或容易被激怒",
    "情绪突然变化",
    "常常生气",
    "多疑",
    "咒骂或讲粗话",
    "声称要自杀",
    "说梦话或梦游",
    "话太多",
    "经常捉弄他人",
    "乱发脾气或脾气暴躁",
    "对性的问题想得太多",
    "威胁他人",
    "吮吸大拇指",
    "过分要求整齐清洁",
    "睡眠有问题",
    "逃学",
    "不够活跃，动作迟钝或精力不足",
    "闷闷不乐，悲伤或抑郁",
    "说话声音特别大",
    "经常喝酒或使用成瘾药物",
    "喜欢破坏东西",
    "白天遗尿",
    "夜间遗尿",
    "爱哭",
    "希望成为异性",
    "退缩、不合群",
    "忧虑重重",
]

CBCL_OPTIONS = [
    {"text": "无", "value": 0},
    {"text": "有时", "value": 1},
    {"text": "经常", "value": 2},
]

PSQI_FREQ = [
    {"text": "无", "value": 0},
    {"text": "<1次/周", "value": 1},
    {"text": "1-2次/周", "value": 2},
    {"text": "≥3次/周", "value": 3},
]

DIM_RANGES_SOMATIZATION = [
    {
        "min": 6,
        "max": 12,
        "level": "正常",
        "description": "您的心理健康状况良好，极少或没有躯体化表现，这是值得肯定和鼓励的。请继续保持积极心态，注重身心健康，以更好地面对生活和工作中的挑战。",
        "suggestions": ["保持规律作息与适度运动", "继续维持良好的生活习惯", "关注身心状态的细微变化"],
    },
    {
        "min": 13,
        "max": 17,
        "level": "轻度躯体化",
        "description": "最近，您可能偶尔体验到一些躯体化表现，如呼吸困难或心跳加快。然而，不用特别担心，这些症状只是短暂出现并很快消退，因此它们并未超出您的控制范围。",
        "suggestions": ["尝试深呼吸与渐进式肌肉放松", "保证充足睡眠，避免过度疲劳", "如症状反复出现，建议关注情绪压力来源"],
    },
    {
        "min": 18,
        "max": 24,
        "level": "中度躯体化",
        "description": "您的身体不适症状已经对生活产生了一定的影响，这给您带来了不小的困扰。为了缓解这些不适，您可以尝试调整生活方式，或者进行放松训练。同时，寻求专业人士的帮助可能会更快地帮助您解决这些问题。",
        "suggestions": ["调整作息，减少熬夜与过度消耗", "进行规律的有氧运动或放松训练", "建议预约专业心理咨询进行进一步评估"],
    },
    {
        "min": 25,
        "max": 30,
        "level": "重度躯体化",
        "description": "您的躯体化表现已经严重干扰了您的日常生活，不仅引发了身体的不适，还对您的社交和工作产生了不良影响。为了缓解这些症状，建议您积极寻求专业医疗人员的帮助。",
        "suggestions": ["尽快联系心理咨询师或精神科医生", "进行必要的医学检查以排除器质性问题", "告知家人或信任的人，获得支持"],
    },
]

DIM_RANGES_DEPRESSION = [
    {
        "min": 6,
        "max": 12,
        "level": "正常",
        "description": "您的心境稳定，鲜有情绪低落的时刻，日常生活充满活力与热情。",
        "suggestions": ["保持规律作息和适度运动", "继续维持良好的社交关系", "关注自我情绪变化"],
    },
    {
        "min": 13,
        "max": 17,
        "level": "轻度抑郁",
        "description": "近期，您可能偶感情绪低落、精力不足，但请放心，此种状态往往非持续性，或仅为短暂性的情绪波动，对您的日常生活影响相对有限。",
        "suggestions": ["尝试正念冥想或户外活动", "与信任的朋友倾诉", "保持规律的运动习惯"],
    },
    {
        "min": 18,
        "max": 24,
        "level": "中度抑郁",
        "description": "您的抑郁情绪已经对您的日常生活造成了一定的影响，您可能时常体验到孤独、苦闷或是觉得生活缺乏意义，对事物丧失了往日的兴趣和活力。面对这种情况，我们建议您尝试通过一些自我调节的方式来改善，例如参加户外远足活动、进行体育锻炼等。同时，我们会建议您寻求专业人员的帮助，他们可以提供更加专业和有效的指导与支持，帮助您更好地应对和解决这些困扰。",
        "suggestions": ["参加户外远足或体育锻炼", "尝试正念冥想或深呼吸练习", "预约专业心理咨询师进行评估"],
    },
    {
        "min": 25,
        "max": 30,
        "level": "重度抑郁",
        "description": "您的抑郁情绪已对生活产生显著影响，包括工作学习的动力下降以及出现自杀念头。鉴于此，我们强烈建议您寻求专业医疗人员的帮助。心理健康与身体健康同等重要，通过专业的心理咨询和治疗，您可以找到缓解抑郁情绪、恢复生活动力的途径。",
        "suggestions": ["请尽快联系专业机构或拨打心理援助热线", "不要独处，寻求家人朋友陪伴", "如有自伤念头，请拨打 400-161-9995"],
    },
]

DIM_RANGES_ANXIETY = [
    {
        "min": 6,
        "max": 12,
        "level": "正常",
        "description": "您的焦虑水平属于正常范畴，很少出现无缘无故的担忧或易激动的情况。这表明您的心理状态稳定，具备应对日常生活压力的能力。请您继续保持这种良好的心态。",
        "suggestions": ["继续保持健康的生活方式", "练习适度的放松技巧", "关注压力管理"],
    },
    {
        "min": 13,
        "max": 17,
        "level": "轻度焦虑",
        "description": "近期，您或许偶尔体验到了较为明显的焦虑情绪，并可能伴有身体上的不适。然而，值得庆幸的是，您的焦虑情绪尚处于可自我调节的范围内，并未对您的日常生活造成长时间的负面影响。这很可能是一种暂时性的情绪反应，建议您保持冷静、理智的态度，采取适当的自我调节措施以缓解焦虑情绪，从而保持身心健康。",
        "suggestions": ["尝试深呼吸和渐进式肌肉放松", "减少咖啡因摄入", "保持规律运动"],
    },
    {
        "min": 18,
        "max": 24,
        "level": "中度焦虑",
        "description": "您目前所经历的焦虑情绪已经对您的生活产生了一定的影响，具体表现为坐立不安和情绪易于激动。为了缓解这些症状，我们建议您尝试一些自我调节的方法，如转移注意力和进行放松训练。同时，我们也鼓励您寻求专业人员的帮助，他们具备专业知识和经验，能够为您提供更加有效和个性化的支持。",
        "suggestions": ["建立固定的放松仪式", "减少信息过载", "预约心理咨询师"],
    },
    {
        "min": 25,
        "max": 30,
        "level": "重度焦虑",
        "description": "您的焦虑症状已经对您的日常生活产生了显著影响，表现为神经过敏、持续不安，甚至在极端情况下出现惊恐发作。考虑到这些症状的严重性，我们建议您尽快寻求专业心理咨询师或精神科医生的帮助，以便进行更全面、系统的评估和治疗。",
        "suggestions": ["尽快联系心理咨询机构", "避免独自承受，寻求支持", "拨打心理援助热线 400-161-9995"],
    },
]


def make_options(prefix: str, template: list[dict]) -> list[dict]:
    return [
        {"id": f"{prefix}-{chr(97 + i)}", "text": o["text"], "value": o["value"]}
        for i, o in enumerate(template)
    ]


def make_questions(items: list[str], prefix: str, template: list[dict]) -> list[dict]:
    return [
        {"id": f"{prefix}{i + 1}", "text": text, "options": make_options(f"{prefix}{i + 1}", template)}
        for i, text in enumerate(items)
    ]


def make_bsi_questions(items: list[str]) -> list[dict]:
    return [
        {
            "id": f"q{i + 1}",
            "text": f"是否出现以下问题：\n{item}",
            "options": make_options(f"q{i + 1}", BSI_OPTIONS),
        }
        for i, item in enumerate(items)
    ]


def bsi18() -> dict:
    return {
        "id": "bsi-18",
        "title": "简明症状量表（BSI-18）",
        "subtitle": "评估躯体化、抑郁与焦虑症状",
        "description": "",
        "cover": "/images/content/assess/assess-bsi-18.jpg",
        "questionCount": 18,
        "duration": 8,
        "scoringType": "dimension",
        "disclaimer": "本测评结果仅供参考，不能替代专业医学诊断。如有需要，请寻求专业心理咨询或医疗帮助。",
        "reportIntro": "经过本次测评，您已获取关于当前心理健康状况的初步评估结果，涵盖躯体化、抑郁以及焦虑三个方面的心理健康水平。请注意，本测评结果仅供参考，不作为专业诊断依据。",
        "dimensions": [
            {
                "id": "somatization",
                "title": "躯体化",
                "intro": "「躯体化」指的是由心理因素所引发的身体症状或疾病。在此情况下，个体可能会选择通过身体症状来间接传达他们的情感、压力或心理困扰，而不是直接表达他们的情感或情绪。这些身体症状可能包括头痛、胃痛、肌肉紧张等，但通过医学检查往往难以找到确切的器质性原因。通常，躯体化与情绪压力、焦虑、抑郁等心理健康问题密切相关。",
                "questionIds": ["q1", "q4", "q7", "q10", "q13", "q16"],
                "aggregate": "sum",
                "scoreRanges": DIM_RANGES_SOMATIZATION,
            },
            {
                "id": "depression",
                "title": "抑郁",
                "intro": "「抑郁状态」是指一种情感上的低沉、沮丧、消极的心境，通常伴随着对日常生活兴趣的减退、自我价值的否定、睡眠质量的下降以及食欲的改变等多种症状。这种状态可能对个体的日常生活功能、社交互动以及工作学习表现产生负面影响。",
                "questionIds": ["q2", "q5", "q8", "q11", "q14", "q17"],
                "aggregate": "sum",
                "scoreRanges": DIM_RANGES_DEPRESSION,
            },
            {
                "id": "anxiety",
                "title": "焦虑",
                "intro": "焦虑情绪往往伴随着一系列身体上的生理反应，包括心跳加速、呼吸变得急促、肌肉紧张以及出汗等现象。在情绪层面，焦虑还可能引发注意力难以集中、情绪波动加剧以及易怒等心理症状。",
                "questionIds": ["q3", "q6", "q9", "q12", "q15", "q18"],
                "aggregate": "sum",
                "scoreRanges": DIM_RANGES_ANXIETY,
            },
        ],
        "questions": make_bsi_questions(BSI_ITEMS),
    }


def aas() -> dict:
    return {
        "id": "aas",
        "title": "成人依恋量表（AAS）",
        "subtitle": "了解您的依恋类型",
        "description": "AAS 由 Collins 等人于 1990 年编制，帮助您了解在亲密关系中的依恋模式：安全型、先占型、拒绝型或恐惧型。",
        "cover": "/images/content/assess/assess-aas.jpg",
        "questionCount": 18,
        "duration": 8,
        "scoringType": "aas",
        "disclaimer": "本测评结果仅供参考，不作为诊断工具。",
        "reverseQuestionIds": ["q2", "q7", "q8", "q13", "q16", "q17", "q18"],
        "matchResults": [
            {"id": "secure", "title": "安全型", "description": "您在人际交往中展现出令人称赞的舒适感，能够从中体验自身价值。在亲密关系中，您能保持内心的安全与宁静，既不会因过于亲密而焦虑，也不会因担忧被遗弃而忧虑。", "image": "/images/content/match-guardian.jpg", "shareText": "我的依恋类型是「安全型」——在关系中既亲密又独立。"},
            {"id": "preoccupied", "title": "先占型", "description": "您表现出对人际关系的强烈渴望，始终致力于赢得他人认可。在亲密关系中展现深切关怀与依赖，但也可能陷入持续的焦虑与内耗。", "image": "/images/content/match-soulmate.jpg", "shareText": "我的依恋类型是「先占型」——渴望亲密，也需要更多安全感。"},
            {"id": "dismissive", "title": "拒绝型", "description": "您秉持独立自主的原则，对过于亲密的关系持谨慎态度。您尊重对方的个人空间，但在情感交流中可能较为保守。", "image": "/images/content/match-adventurer.jpg", "shareText": "我的依恋类型是「拒绝型」——独立自足，也需要学习更多情感表达。"},
            {"id": "fearful", "title": "恐惧型", "description": "您可能对深入联系抱有期望，但当真正接近他人时会因内心不安而选择回避。在亲密关系中，您可能表面沉默，内心却充满焦虑与波动。", "image": "/images/content/match-lavender.jpg", "shareText": "我的依恋类型是「恐惧型」——渴望连接，也需要更多勇气。"},
        ],
        "questions": make_questions(AAS_ITEMS, "q", LIKERT_5),
    }


def psqi() -> dict:
    questions = [
        {
            "id": "q2",
            "text": "近1个月，从上床到入睡通常需要多长时间？",
            "options": make_options("q2", [
                {"text": "≤15分钟", "value": 0},
                {"text": "16-30分钟", "value": 1},
                {"text": "31-60分钟", "value": 2},
                {"text": ">60分钟", "value": 3},
            ]),
        },
        {
            "id": "q4",
            "text": "近1个月，每夜通常实际睡眠多少小时（不等于卧床时间）？",
            "options": make_options("q4", [
                {"text": ">7小时", "value": 0},
                {"text": "6-7小时", "value": 1},
                {"text": "5-6小时", "value": 2},
                {"text": "<5小时", "value": 3},
            ]),
        },
    ]
    disturbances = [
        "入睡困难（30分钟内不能入睡）",
        "夜间易醒或早醒",
        "夜间去厕所",
        "呼吸不畅",
        "咳嗽或鼾声高",
        "感觉冷",
        "感觉热",
        "做恶梦",
        "疼痛不适",
        "其他影响睡眠的事情",
    ]
    for i, text in enumerate(disturbances):
        qid = f"q5{chr(97 + i)}"
        questions.append({"id": qid, "text": f"近1个月，因下列情况影响睡眠而烦恼：{text}", "options": make_options(qid, PSQI_FREQ)})

    questions.extend([
        {
            "id": "q6",
            "text": "近1个月，总的来说，您认为自己的睡眠质量",
            "options": make_options("q6", [
                {"text": "很好", "value": 0},
                {"text": "较好", "value": 1},
                {"text": "较差", "value": 2},
                {"text": "很差", "value": 3},
            ]),
        },
        {"id": "q7", "text": "近1个月，您用药物催眠的情况", "options": make_options("q7", PSQI_FREQ)},
        {"id": "q8", "text": "近1个月，您常感到困倦吗", "options": make_options("q8", PSQI_FREQ)},
        {
            "id": "q9",
            "text": "近1个月，您做事情的精力不足吗",
            "options": make_options("q9", [
                {"text": "没有", "value": 0},
                {"text": "偶尔有", "value": 1},
                {"text": "有时有", "value": 2},
                {"text": "经常有", "value": 3},
            ]),
        },
    ])

    return {
        "id": "psqi",
        "title": "匹兹堡睡眠质量指数（PSQI）",
        "subtitle": "评估近1个月的睡眠质量",
        "description": "PSQI 是广泛使用的睡眠质量评估工具，由 7 个成分构成，总分 0-21 分，得分越高表示睡眠质量越差。",
        "cover": "/images/content/assess/assess-psqi.jpg",
        "questionCount": len(questions),
        "duration": 8,
        "scoringType": "psqi",
        "disclaimer": "本测评结果仅供参考，不能替代专业医学诊断。如睡眠问题持续，请咨询医生或睡眠专家。",
        "scoreRanges": [
            {"min": 0, "max": 5, "level": "睡眠质量很好", "description": "您的睡眠质量很好，暂时没有明显的睡眠问题。入睡与醒来时间较规律，睡眠过程顺畅。", "suggestions": ["继续保持良好的睡眠习惯", "维持规律作息"]},
            {"min": 6, "max": 10, "level": "睡眠质量较好", "description": "您的睡眠质量总体良好，但可能存在一些可以改进的小问题。", "suggestions": ["避免睡前使用电子设备", "制定固定的睡眠时间表", "注意睡前饮食"]},
            {"min": 11, "max": 15, "level": "睡眠质量一般", "description": "您的睡眠质量一般，有时可能遇到入睡困难或夜间多次醒来。", "suggestions": ["限制晚间咖啡因和酒精", "确保卧室环境安静、黑暗", "尝试放松技巧如深呼吸"]},
            {"min": 16, "max": 21, "level": "睡眠质量差", "description": "您的睡眠质量较差，可能经常遭受睡眠障碍，建议尽快咨询医生或睡眠专家。", "suggestions": ["主动排解压力", "向专业人士求助", "与医生讨论可能的解决方案"]},
        ],
        "questions": questions,
    }


def pbi() -> dict:
    questions = []
    for i, text in enumerate(PBI_MOTHER):
        qid = f"m{i + 1}"
        questions.append({"id": qid, "text": f"在我16岁前，我的母亲：{text}", "options": make_options(qid, PBI_OPTIONS)})
    for i, text in enumerate(PBI_FATHER):
        qid = f"f{i + 1}"
        questions.append({"id": qid, "text": f"在我16岁前，我的父亲：{text}", "options": make_options(qid, PBI_OPTIONS)})

    return {
        "id": "pbi",
        "title": "父母教养方式问卷（PBI）",
        "subtitle": "回顾16岁前的父母养育方式",
        "description": "PBI 评估个体对儿童时期（16岁以前）父母养育方式的认知，分为关爱、鼓励自主和控制三个因子，并据此判断教养类型。",
        "cover": "/images/content/assess/assess-pbi.jpg",
        "questionCount": len(questions),
        "duration": 15,
        "scoringType": "pbi",
        "disclaimer": "本测评结果仅供参考，不能替代专业心理评估。",
        "questions": questions,
    }


def cbcl() -> dict:
    return {
        "id": "cbcl",
        "title": "儿童行为量表（CBCL）",
        "subtitle": "筛查6-16岁儿童行为问题",
        "description": "CBCL 用于筛查儿童的各种行为问题，请根据孩子近半年内的表现认真作答。",
        "cover": "/images/content/assess/assess-cbcl.jpg",
        "questionCount": len(CBCL_ITEMS),
        "duration": 25,
        "scoringType": "cbcl",
        "disclaimer": "本测评结果仅供参考，不能替代专业诊断。如得分较高，建议寻求儿童心理专业人士评估。",
        "questions": make_questions(CBCL_ITEMS, "q", CBCL_OPTIONS),
    }


def dark_light_fun() -> dict:
    dark_items = [
        "TA倾向于操纵别人以达到自己的目的",
        "TA习惯于欺骗别人以达到自己的目的",
        "TA习惯于奉承别人以达到自己的目的",
        "TA倾向于利用别人以达到自己的目的",
        "TA缺乏悔恨之心",
        "TA不太关心自己的行为是否符合道德规范",
        "TA冷酷、麻木",
        "TA愤世嫉俗",
        "TA希望别人赞美他/她",
        "TA希望别人关注他/她",
        "TA追求名誉地位",
        "TA期望从别人那里获得特殊礼遇",
    ]
    light_kant = [
        "我认为诚实比魅力更重要",
        "公然操纵别人去做我想做的事会让我感觉不舒服",
        "就算展现真实的自我可能损害我的名誉，我也愿意这样做",
        "当我和别人交谈时，我很少考虑我想从他们那里得到什么",
    ]
    light_human = [
        "我愿意从好的一面去看待一个人",
        "我愿意相信别人会公平地对待我",
        "我认为大多数人都是好人",
        "我很容易原谅伤害过我的人",
        "我愿意去赞美别人的优点",
        "我愿意为他人的成功喝彩",
        "我愿意把别人看作有价值的人",
    ]

    likert_7 = [
        {"text": "完全不同意", "value": 1},
        {"text": "部分不同意", "value": 2},
        {"text": "略微不同意", "value": 3},
        {"text": "不确定", "value": 4},
        {"text": "略微同意", "value": 5},
        {"text": "部分同意", "value": 6},
        {"text": "完全同意", "value": 7},
    ]

    questions = []
    for i, text in enumerate(dark_items):
        qid = f"d{i + 1}"
        questions.append({"id": qid, "text": text, "options": make_options(qid, likert_7)})
    for i, text in enumerate(light_kant + light_human):
        qid = f"l{i + 1}"
        questions.append({"id": qid, "text": text, "options": make_options(qid, likert_7)})

    return {
        "id": "dark-light-personality",
        "title": "光明与黑暗人格测试",
        "subtitle": "评估伴侣黑暗特质与自身光明人格",
        "description": "本测试包含黑暗十二条（评估伴侣/TA 的马基雅维利主义、精神病态与自恋倾向）以及光明人格量表（评估您的康德主义与人道主义特质）。仅供娱乐与参考。",
        "cover": "/images/content/assess/assess-dark-light.jpg",
        "questionCount": len(questions),
        "duration": 10,
        "scoringType": "dark-light",
        "disclaimer": "本测试仅供娱乐，结果仅供参考，不能替代专业诊断。如有人际关系困扰，请寻求专业帮助。",
        "questions": questions,
    }


def main() -> None:
    professional = [bsi18(), aas(), psqi(), pbi(), cbcl()]
    fun = [dark_light_fun()]

    OUT_PRO.write_text(json.dumps(professional, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_FUN.write_text(json.dumps(fun, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PRO} ({len(professional)} assessments)")
    print(f"Wrote {OUT_FUN} ({len(fun)} assessments)")


if __name__ == "__main__":
    main()
