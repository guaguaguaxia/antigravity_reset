export const LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어"
};

export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  ja: "ja_JP",
  ko: "ko_KR"
};

export function localePath(locale: Locale): string {
  return locale === "en" ? "/" : `/${locale}`;
}

export function resetDetailPath(id: string, locale: Locale = "en"): string {
  const encodedId = encodeURIComponent(id);
  return locale === "en" ? `/resets/${encodedId}` : `/${locale}/resets/${encodedId}`;
}

export function apiDocsPath(locale: Locale = "en"): string {
  return locale === "en" ? "/api/docs" : `/${locale}/api/docs`;
}

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const trimmed = input.trim();
  return (LOCALES as readonly string[]).includes(trimmed) ? (trimmed as Locale) : null;
}

export function localeFromPath(pathname: string): Locale {
  const cleaned = pathname.replace(/\.md$/, "").replace(/\/+$/, "") || "/";
  for (const locale of LOCALES) {
    if (localePath(locale) === cleaned) {
      return locale;
    }
  }
  return "en";
}

/** Match an HTTP Accept-Language header (respecting q weights) against supported site locales. */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header || !header.trim()) return null;

  const candidates = header
    .split(",")
    .map((part, index) => {
      const segments = part
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const tag = (segments[0] ?? "").toLowerCase();
      let q = 1;
      for (const param of segments.slice(1)) {
        const match = /^q\s*=\s*([0-9]+(?:\.[0-9]+)?)$/i.exec(param);
        if (match) {
          q = Number.parseFloat(match[1]);
        }
      }
      return { tag, q, index };
    })
    .filter((item) => item.tag && Number.isFinite(item.q) && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of candidates) {
    if (tag === "en" || tag.startsWith("en-")) return "en";
    if (
      tag === "zh-tw" ||
      tag === "zh-hk" ||
      tag === "zh-mo" ||
      /(?:^|-)hant(?:$|-)/.test(tag)
    ) {
      return "zh-TW";
    }
    if (tag === "zh" || tag.startsWith("zh-")) return "zh-CN";
    if (tag === "ja" || tag.startsWith("ja-")) return "ja";
    if (tag === "ko" || tag.startsWith("ko-")) return "ko";
  }

  return null;
}

const MESSAGES = {
  "Antigravity Reset — Live Quota Reset Tracker & History": {
    "zh-CN": "Antigravity Reset — 实时额度重置追踪与历史记录",
    "zh-TW": "Antigravity Reset — 即時額度重置追蹤與歷史紀錄",
    ja: "Antigravity Reset — リアルタイムクォータリセット追跡・履歴",
    ko: "Antigravity Reset — 실시간 쿼터 리셋 추적 및 기록"
  },
  "Track {count} verified Google Antigravity quota resets (latest: {date}). Browse Gemini, Argon & all-model reset history and get live alerts.": {
    "zh-CN": "追踪 {count} 次 Google Antigravity 官方额度重置记录（最近：{date}）。查看 Gemini、Argon 及全模型额度刷新历史，并订阅实时通知。",
    "zh-TW": "追蹤 {count} 次 Google Antigravity 官方額度重置紀錄（最近：{date}）。查看 Gemini、Argon 與全模型額度刷新歷史，並訂閱即時通知。",
    ja: "Google Antigravity の公式クォータリセット {count} 件を追跡中（最新: {date}）。Gemini・Argon・全モデルのリセット履歴確認やライブ通知に対応。",
    ko: "검증된 Google Antigravity 쿼터 리셋 {count}건(최신: {date})을 추적합니다. Gemini·Argon·전체 모델 리셋 기록을 확인하고 실시간 알림을 받아보세요."
  },
  "Frequently asked questions": {
    "zh-CN": "常见问题",
    "zh-TW": "常見問題",
    ja: "よくある質問",
    ko: "자주 묻는 질문"
  },
  "Everything about Antigravity quota resets": {
    "zh-CN": "关于 Antigravity 额度重置的常见说明",
    "zh-TW": "關於 Antigravity 額度重置的常見說明",
    ja: "Antigravity クォータリセットに関する解説",
    ko: "Antigravity 쿼터 리셋에 대한 안내"
  },
  "Antigravity Reset quota tracker": {
    "zh-CN": "Antigravity Reset 额度重置追踪器",
    "zh-TW": "Antigravity Reset 額度重置追蹤器",
    ja: "Antigravity Reset クォータトラッカー",
    ko: "Antigravity Reset 쿼터 트래커"
  },
  Language: {
    "zh-CN": "语言",
    "zh-TW": "語言",
    ja: "言語",
    ko: "언어"
  },
  "Follow @_mohansolo on X": {
    "zh-CN": "在 X 关注 @_mohansolo",
    "zh-TW": "在 X 追蹤 @_mohansolo",
    ja: "X で @_mohansolo をフォロー",
    ko: "X에서 @_mohansolo 팔로우"
  },
  "Toggle color theme": {
    "zh-CN": "切换明暗主题",
    "zh-TW": "切換明暗主題",
    ja: "カラーテーマを切り替える",
    ko: "밝은 테마와 어두운 테마 전환"
  },
  "Switch to dark mode": {
    "zh-CN": "切换到深色模式",
    "zh-TW": "切換至深色模式",
    ja: "ダークモードに切り替える",
    ko: "어두운 테마로 전환"
  },
  "Switch to light mode": {
    "zh-CN": "切换到浅色模式",
    "zh-TW": "切換至淺色模式",
    ja: "ライトモードに切り替える",
    ko: "밝은 테마로 전환"
  },
  "{count} here now": {
    "zh-CN": "{count} 人在线",
    "zh-TW": "{count} 人在線",
    ja: "{count} 人がオンライン",
    ko: "지금 {count}명 접속 중"
  },
  "Connecting to live visitor count": {
    "zh-CN": "正在连接实时在线人数",
    "zh-TW": "正在連線至即時在線人數",
    ja: "リアルタイムのオンライン人数に接続中",
    ko: "실시간 접속자 수에 연결 중"
  },
  "Live visitor count unavailable": {
    "zh-CN": "暂时无法获取实时在线人数",
    "zh-TW": "暫時無法取得即時在線人數",
    ja: "リアルタイムのオンライン人数を取得できません",
    ko: "실시간 접속자 수를 확인할 수 없습니다"
  },
  "We watch {account} for Antigravity reset announcements, so you don't have to.": {
    "zh-CN": "我们帮你关注 {account} 发布的 Antigravity 额度重置消息，省得你反复刷推。",
    "zh-TW": "我們幫你追蹤 {account} 發布的 Antigravity 額度重置消息，省得你反覆刷動態。",
    ja: "{account} の Antigravity クォータリセット情報をチェックして、お知らせします。",
    ko: "{account}의 Antigravity 쿼터 리셋 소식을 대신 확인해 드립니다."
  },
  "Current status": {
    "zh-CN": "当前状态",
    "zh-TW": "目前狀態",
    ja: "現在の状況",
    ko: "현재 상태"
  },
  "Reset notifications": {
    "zh-CN": "重置通知",
    "zh-TW": "重置通知",
    ja: "リセット通知",
    ko: "리셋 알림"
  },
  "Get browser notifications when Antigravity resets": {
    "zh-CN": "Antigravity 重置时接收浏览器通知",
    "zh-TW": "Antigravity 重置時接收瀏覽器通知",
    ja: "Antigravity のリセットをブラウザ通知で受け取る",
    ko: "Antigravity 리셋 시 브라우저 알림 받기"
  },
  "Stop browser notifications for Antigravity resets": {
    "zh-CN": "关闭 Antigravity 重置的浏览器通知",
    "zh-TW": "關閉 Antigravity 重置的瀏覽器通知",
    ja: "Antigravity リセットのブラウザ通知を停止する",
    ko: "Antigravity 리셋 브라우저 알림 끄기"
  },
  browser: {
    "zh-CN": "浏览器",
    "zh-TW": "瀏覽器",
    ja: "ブラウザ",
    ko: "브라우저"
  },
  "browser on": {
    "zh-CN": "浏览器通知已开启",
    "zh-TW": "瀏覽器通知已開啟",
    ja: "ブラウザ通知オン",
    ko: "브라우저 알림 켜짐"
  },
  "Subscribe via RSS feed": {
    "zh-CN": "通过 RSS 订阅重置通知",
    "zh-TW": "透過 RSS 訂閱重置通知",
    ja: "RSS フィードで購読する",
    ko: "RSS 피드로 구독하기"
  },
  "Get reset alerts by email": {
    "zh-CN": "通过邮件接收 Antigravity 重置通知",
    "zh-TW": "透過電子郵件接收 Antigravity 重置通知",
    ja: "メールで Antigravity リセット通知を受け取る",
    ko: "이메일로 Antigravity 리셋 알림 받기"
  },
  email: {
    "zh-CN": "邮件",
    "zh-TW": "電子郵件",
    ja: "メール",
    ko: "이메일"
  },
  "Email address": {
    "zh-CN": "邮箱地址",
    "zh-TW": "電子郵件地址",
    ja: "メールアドレス",
    ko: "이메일 주소"
  },
  "send link": {
    "zh-CN": "订阅通知",
    "zh-TW": "訂閱通知",
    ja: "登録する",
    ko: "구독하기"
  },
  "sending…": {
    "zh-CN": "提交中…",
    "zh-TW": "送出中…",
    ja: "送信中…",
    ko: "전송 중…"
  },
  "email on": {
    "zh-CN": "邮件通知已开启",
    "zh-TW": "郵件通知已開啟",
    ja: "メール通知オン",
    ko: "이메일 알림 켜짐"
  },
  "You're on the list. We'll notify you when new Antigravity resets land.": {
    "zh-CN": "已加入订阅列表，后续有新的 Antigravity 重置消息时会通知你。",
    "zh-TW": "已加入訂閱清單，後續有新的 Antigravity 重置消息時會通知你。",
    ja: "登録が完了しました。新しい Antigravity リセットが発表され次第お知らせします。",
    ko: "구독이 완료됐습니다. 새로운 Antigravity 리셋 소식이 올라오면 알려드릴게요."
  },
  "That didn't send. Please try again.": {
    "zh-CN": "提交失败，请重试。",
    "zh-TW": "送出失敗，請再試一次。",
    ja: "送信できませんでした。もう一度お試しください。",
    ko: "전송하지 못했습니다. 다시 시도해 주세요."
  },
  "Enter a valid email address": {
    "zh-CN": "请输入有效的邮箱地址",
    "zh-TW": "請輸入有效的電子郵件地址",
    ja: "有効なメールアドレスを入力してください",
    ko: "올바른 이메일 주소를 입력하세요"
  },
  "No ping for you: notifications are blocked here.": {
    "zh-CN": "通知被浏览器屏蔽了，请先在浏览器设置中允许通知。",
    "zh-TW": "通知被瀏覽器封鎖了，請先在瀏覽器設定中允許通知。",
    ja: "通知がブロックされています。ブラウザの設定で許可してください。",
    ko: "알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해 주세요."
  },
  "Deal. The next reset pings you first.": {
    "zh-CN": "说定了，下次重置时会在页面保持打开期间第一时间通知你。",
    "zh-TW": "說定了，下次重置時會在頁面開啟期間第一時間通知你。",
    ja: "了解。次のリセットをいち早くお知らせします。",
    ko: "좋아요. 다음 리셋 때 바로 알려드릴게요."
  },
  "Okay. You'll find out like everyone else.": {
    "zh-CN": "已关闭通知，下次就靠你自己发现了。",
    "zh-TW": "已關閉通知，下次就靠你自己發現了。",
    ja: "通知をオフにしました。次は自分で見つけてくださいね。",
    ko: "알림을 껐습니다. 다음 소식은 직접 확인해 주세요."
  },
  "That didn't take. Please try again.": {
    "zh-CN": "操作失败，请重试。",
    "zh-TW": "操作失敗，請再試一次。",
    ja: "うまくいきませんでした。もう一度お試しください。",
    ko: "처리하지 못했습니다. 다시 시도해 주세요."
  },
  "Time display": {
    "zh-CN": "时间显示",
    "zh-TW": "時間顯示",
    ja: "時刻表示",
    ko: "시간 표시"
  },
  "Mohan time": {
    "zh-CN": "Mohan 时间",
    "zh-TW": "Mohan 時間",
    ja: "Mohan の時間",
    ko: "Mohan 시간"
  },
  "Local time": {
    "zh-CN": "本地时间",
    "zh-TW": "本地時間",
    ja: "現地時間",
    ko: "현지 시간"
  },
  "Switch to Mohan time": {
    "zh-CN": "切换到 Mohan 时间",
    "zh-TW": "切換至 Mohan 時間",
    ja: "Mohan の時間に切り替える",
    ko: "Mohan 시간으로 전환"
  },
  "Switch to local time": {
    "zh-CN": "切换到本地时间",
    "zh-TW": "切換至本地時間",
    ja: "現地時間に切り替える",
    ko: "현지 시간으로 전환"
  },
  "{time} for Mohan": {
    "zh-CN": "Mohan 现在 {time}",
    "zh-TW": "Mohan 現在 {time}",
    ja: "Mohan のいま {time}",
    ko: "Mohan의 지금 {time}"
  },
  "Mohan is probably asleep. Let him dream of quota resets.": {
    "zh-CN": "Mohan 大概睡了吧，祝他做个重置的好梦。",
    "zh-TW": "Mohan 應該睡了，讓他夢見額度重置吧。",
    ja: "Mohan はたぶん寝ています。クォータリセットの夢を見させてあげて。",
    ko: "Mohan은 아마 자고 있어요. 리셋 꿈을 꾸게 두세요."
  },
  "Coffee first. Resets later.": {
    "zh-CN": "先喝咖啡，重置稍后。",
    "zh-TW": "先喝咖啡，重置稍後。",
    ja: "まずコーヒー、リセットはあとで。",
    ko: "커피 먼저, 리셋은 나중에."
  },
  "Mohan is probably shipping Antigravity right now.": {
    "zh-CN": "Mohan 这会儿大概在发布 Antigravity 新功能。",
    "zh-TW": "Mohan 這會兒應該在打造 Antigravity。",
    ja: "Mohan はいま Antigravity を開発・出荷中のはず。",
    ko: "Mohan은 아마 지금 Antigravity를 출시하는 중이에요."
  },
  "Lunch break. The quotas can wait.": {
    "zh-CN": "午饭时间，额度的事等会儿再说。",
    "zh-TW": "午餐時間，額度的事等等再說。",
    ja: "昼休み。クォータはあとで。",
    ko: "점심 시간. 쿼터는 나중에."
  },
  "Golden hour in California.": {
    "zh-CN": "加州的黄金时刻。",
    "zh-TW": "加州的黃金時刻。",
    ja: "カリフォルニアのゴールデンアワー。",
    ko: "캘리포니아의 골든 아워."
  },
  "Late night. Just one more deploy…": {
    "zh-CN": "深夜了，再发一版就睡……",
    "zh-TW": "深夜了，再發一版就睡……",
    ja: "深夜。もうひとつリリースしたら…",
    ko: "늦은 밤. 배포 하나만 더…"
  },
  "It's the weekend. Even Mohan touches grass.": {
    "zh-CN": "周末了，Mohan 也得出门透透气。",
    "zh-TW": "週末了，Mohan 也得出去透透氣。",
    ja: "週末です。Mohan だって外に出ます。",
    ko: "주말이에요. Mohan도 밖에 나가죠."
  },
  "Latest Antigravity reset": {
    "zh-CN": "最近一次 Antigravity 重置",
    "zh-TW": "最近一次 Antigravity 重置",
    ja: "直近の Antigravity リセット",
    ko: "최근 Antigravity 리셋"
  },
  "No resets tracked yet": {
    "zh-CN": "还没有重置记录",
    "zh-TW": "還沒有重置紀錄",
    ja: "リセットの記録はまだありません",
    ko: "아직 리셋 기록이 없습니다"
  },
  "Once @_mohansolo announces one, it'll show up here within minutes.": {
    "zh-CN": "@_mohansolo 发布重置公告后，更新就会显示在这里。",
    "zh-TW": "@_mohansolo 發布重置公告後，更新就會顯示在這裡。",
    ja: "@_mohansolo がリセットを発表すると、ここに表示されます。",
    ko: "@_mohansolo가 리셋을 발표하면 여기에 표시됩니다."
  },
  "Gemini quota reset": {
    "zh-CN": "Gemini 额度重置",
    "zh-TW": "Gemini 額度重置",
    ja: "Gemini クォータリセット",
    ko: "Gemini 쿼터 리셋"
  },
  "All-model / multi-model reset": {
    "zh-CN": "全模型 / 多模型重置",
    "zh-TW": "全模型 / 多模型重置",
    ja: "全モデル / マルチモデルリセット",
    ko: "전체 / 다중 모델 리셋"
  },
  "Covers the Gemini model quota across Antigravity tiers for the announcement listed below.": {
    "zh-CN": "涵盖 Antigravity 各档位用户的 Gemini 模型使用额度重置。",
    "zh-TW": "涵蓋 Antigravity 各方案使用者的 Gemini 模型使用額度重置。",
    ja: "Antigravity の各プランにおける Gemini モデルのクォータを対象としたリセットです。",
    ko: "Antigravity 등급 전반의 Gemini 모델 쿼터가 리셋되었습니다."
  },
  "Covers all models or multiple model families (such as Gemini & Argon) across Antigravity.": {
    "zh-CN": "涵盖 Antigravity 全部模型或多个模型系列（例如 Gemini 与 Argon）的额度重置。",
    "zh-TW": "涵蓋 Antigravity 全部模型或多個模型系列（例如 Gemini 與 Argon）的額度重置。",
    ja: "Antigravity の全モデル、または複数モデル（Gemini や Argon など）のクォータを対象としたリセットです。",
    ko: "Antigravity의 전체 모델 또는 여러 모델군(Gemini, Argon 등)의 쿼터가 리셋되었습니다."
  },
  "Reset reactions": {
    "zh-CN": "重置互动",
    "zh-TW": "重置互動",
    ja: "リセットへのリアクション",
    ko: "리셋 반응"
  },
  "Reset reaction count unavailable": {
    "zh-CN": "互动次数暂不可用",
    "zh-TW": "互動次數暫時無法取得",
    ja: "リアクション数を取得できません",
    ko: "반응 수를 불러올 수 없습니다"
  },
  "{count} reactions since last reset": {
    "zh-CN": "上次重置以来共 {count} 次互动",
    "zh-TW": "上次重置以來共 {count} 次互動",
    ja: "前回のリセット以降のリアクション：{count}件",
    ko: "지난 리셋 이후 반응 {count}회"
  },
  "Say thanks for the reset": {
    "zh-CN": "感谢这次重置",
    "zh-TW": "感謝這次重置",
    ja: "リセットに感謝する",
    ko: "리셋에 감사하기"
  },
  "Beg for a reset": {
    "zh-CN": "求一次重置",
    "zh-TW": "求一次重置",
    ja: "リセットをお願いする",
    ko: "리셋 부탁하기"
  },
  thanks: {
    "zh-CN": "感谢",
    "zh-TW": "感謝",
    ja: "感謝",
    ko: "감사해요"
  },
  beg: {
    "zh-CN": "求重置",
    "zh-TW": "求重置",
    ja: "お願い",
    ko: "리셋 부탁해요"
  },
  thx: {
    "zh-CN": "谢谢",
    "zh-TW": "謝謝",
    ja: "感謝",
    ko: "감사"
  },
  pls: {
    "zh-CN": "求求了",
    "zh-TW": "拜託了",
    ja: "お願い",
    ko: "부탁"
  },
  Resets: {
    "zh-CN": "重置次数",
    "zh-TW": "重置次數",
    ja: "リセット数",
    ko: "리셋 횟수"
  },
  "Avg. reset interval": {
    "zh-CN": "平均重置间隔",
    "zh-TW": "平均重置間隔",
    ja: "平均リセット間隔",
    ko: "평균 리셋 간격"
  },
  "Avg. wait": {
    "zh-CN": "平均等待",
    "zh-TW": "平均等待",
    ja: "平均待ち時間",
    ko: "평균 대기"
  },
  "Longest wait": {
    "zh-CN": "最长等待",
    "zh-TW": "最長等待",
    ja: "最長待ち時間",
    ko: "최장 대기"
  },
  "{days}d": {
    "zh-CN": "{days}天",
    "zh-TW": "{days}天",
    ja: "{days}日",
    ko: "{days}일"
  },
  "Antigravity reset history": {
    "zh-CN": "Antigravity 重置历史",
    "zh-TW": "Antigravity 重置歷史",
    ja: "Antigravity リセット履歴",
    ko: "Antigravity 리셋 기록"
  },
  regular: {
    "zh-CN": "Gemini 常规",
    "zh-TW": "Gemini 常規",
    ja: "Gemini 通常",
    ko: "Gemini 일반"
  },
  all: {
    "zh-CN": "全模型 / 多模型",
    "zh-TW": "全模型 / 多模型",
    ja: "全モデル / 複数",
    ko: "전체 / 다중 모델"
  },
  "no reset": {
    "zh-CN": "未重置",
    "zh-TW": "未重置",
    ja: "リセットなし",
    ko: "리셋 없음"
  },
  "No reset": {
    "zh-CN": "未重置",
    "zh-TW": "未重置",
    ja: "リセットなし",
    ko: "리셋 없음"
  },
  "{count} {type} reset": {
    "zh-CN": "{count} 次{type}重置",
    "zh-TW": "{count} 次{type}重置",
    ja: "{type}リセット{count}回",
    ko: "{type} 리셋 {count}회"
  },
  "{count} {type} resets": {
    "zh-CN": "{count} 次{type}重置",
    "zh-TW": "{count} 次{type}重置",
    ja: "{type}リセット{count}回",
    ko: "{type} 리셋 {count}회"
  },
  "{label} on {date} (UTC)": {
    "zh-CN": "{date}（UTC）：{label}",
    "zh-TW": "{date}（UTC）：{label}",
    ja: "{date}（UTC）：{label}",
    ko: "{date} (UTC): {label}"
  },
  "{count} resets in one day. Feast.": {
    "zh-CN": "一天重置 {count} 次。盛宴。",
    "zh-TW": "一天重置 {count} 次。盛宴。",
    ja: "1日に{count}回。大盤振る舞い。",
    ko: "하루에 리셋 {count}회. 풍성한 하루네요."
  },
  "No reset. We persevered.": {
    "zh-CN": "没有重置。我们坚持住了。",
    "zh-TW": "沒有重置。我們堅持住了。",
    ja: "リセットなし。耐え抜きました。",
    ko: "리셋 없음. 버텼습니다."
  },
  "No reset. He was busy.": {
    "zh-CN": "没有重置。他在忙。",
    "zh-TW": "沒有重置。他在忙。",
    ja: "リセットなし。忙しかったのでしょう。",
    ko: "리셋 없음. 바빴나 봅니다."
  },
  "No reset. The feed was quiet.": {
    "zh-CN": "没有重置。推文也很安静。",
    "zh-TW": "沒有重置。動態也很安靜。",
    ja: "リセットなし。タイムラインも静かでした。",
    ko: "리셋 없음. 타임라인도 조용했습니다."
  },
  "No reset. We refreshed anyway.": {
    "zh-CN": "没有重置。但我们还是刷新了。",
    "zh-TW": "沒有重置。但我們還是重新整理了。",
    ja: "リセットなし。それでも更新しました。",
    ko: "리셋 없음. 그래도 새로고침은 했습니다."
  },
  "No reset. Character-building day.": {
    "zh-CN": "没有重置。又是磨炼意志的一天。",
    "zh-TW": "沒有重置。又是磨練意志的一天。",
    ja: "リセットなし。忍耐力が鍛えられた日。",
    ko: "리셋 없음. 인내심을 기른 하루."
  },
  "Antigravity reset announcements": {
    "zh-CN": "Antigravity 重置公告",
    "zh-TW": "Antigravity 重置公告",
    ja: "Antigravity リセットのお知らせ",
    ko: "Antigravity 리셋 발표"
  },
  "Every announcement, preserved for history": {
    "zh-CN": "每次公告，都留有记录",
    "zh-TW": "每次公告，都留有紀錄",
    ja: "すべての発表を記録",
    ko: "모든 발표를 기록합니다"
  },
  "Nothing yet. The timeline is quiet. Too quiet.": {
    "zh-CN": "还没有消息。时间线很安静，安静得有点过头了。",
    "zh-TW": "還沒有消息。時間軸很安靜，安靜得有點過頭了。",
    ja: "まだ何もありません。静かです。静かすぎるくらい。",
    ko: "아직 소식이 없네요. 타임라인이 조용합니다. 너무 조용하네요."
  },
  "View on X &rarr;": {
    "zh-CN": "在 X 查看 &rarr;",
    "zh-TW": "在 X 查看 &rarr;",
    ja: "X で見る &rarr;",
    ko: "X에서 보기 &rarr;"
  },
  "Show all {count} resets": {
    "zh-CN": "查看全部 {count} 次重置",
    "zh-TW": "查看全部 {count} 次重置",
    ja: "全{count}回のリセットを表示",
    ko: "리셋 {count}회 모두 보기"
  },
  "Show fewer": {
    "zh-CN": "收起",
    "zh-TW": "收合",
    ja: "折りたたむ",
    ko: "접기"
  },
  "All Models": {
    "zh-CN": "全模型",
    "zh-TW": "全模型",
    ja: "全モデル",
    ko: "전체 모델"
  },
  Verified: {
    "zh-CN": "已核实",
    "zh-TW": "已核實",
    ja: "確認済み",
    ko: "확인됨"
  },
  "just now": {
    "zh-CN": "刚刚",
    "zh-TW": "剛剛",
    ja: "たった今",
    ko: "방금"
  },
  "Date unavailable": {
    "zh-CN": "日期不可用",
    "zh-TW": "日期無法取得",
    ja: "日付を取得できません",
    ko: "날짜를 불러올 수 없습니다"
  },
  "Data from @_mohansolo's posts on X, tracked for Antigravity Reset. Not affiliated with Google.": {
    "zh-CN": "数据整理自 @_mohansolo 在 X 发布的公告，专为 Antigravity Reset 追踪展示。本站与 Google 无关联。",
    "zh-TW": "資料整理自 @_mohansolo 在 X 發布的公告，專為 Antigravity Reset 追蹤展示。本站與 Google 無關聯。",
    ja: "データは @_mohansolo の X 投稿をもとに Antigravity Reset 用に記録しています。Google とは関係ありません。",
    ko: "데이터는 @_mohansolo의 X 게시물을 바탕으로 Antigravity Reset에서 기록합니다. Google과는 관련이 없습니다."
  },
  "Mohan, if you're reading this: no pressure.": {
    "zh-CN": "Mohan，如果你看到这里：别有压力。",
    "zh-TW": "Mohan，如果你看到這裡：別有壓力。",
    ja: "Mohan、これを読んでいたら：気にしないでね。",
    ko: "Mohan, 혹시 이걸 보고 있다면 부담 갖지 마세요."
  },
  "Want the data? There's free public {api}, {rss}, and {md}.": {
    "zh-CN": "想使用这些数据？我们提供免费的公开 {api}、{rss} 和 {md}。",
    "zh-TW": "想使用這些資料？我們提供免費的公開 {api}、{rss} 與 {md}。",
    ja: "データは無料の公開 {api}、{rss}、{md} で利用できます。",
    ko: "데이터가 필요하신가요? 무료 공개 {api}, {rss}, {md}를 이용해 보세요."
  },
  "Last synced: {time}": {
    "zh-CN": "最近同步：{time}",
    "zh-TW": "最近同步：{time}",
    ja: "最終同期：{time}",
    ko: "최근 동기화: {time}"
  },
  Details: {
    "zh-CN": "详情",
    "zh-TW": "詳情",
    ja: "詳細",
    ko: "상세 보기"
  },
  "Back to all resets": {
    "zh-CN": "返回全部重置记录",
    "zh-TW": "返回全部重置紀錄",
    ja: "すべてのリセット履歴に戻る",
    ko: "전체 리셋 기록으로 돌아가기"
  },
  "Official announcement": {
    "zh-CN": "官方重置公告",
    "zh-TW": "官方重置公告",
    ja: "公式アナウンス",
    ko: "공식 발표"
  },
  "Original English announcement": {
    "zh-CN": "英文原文公告",
    "zh-TW": "英文原文公告",
    ja: "英語の原文アナウンス",
    ko: "영어 원문 공지"
  },
  "Reset details": {
    "zh-CN": "重置详情",
    "zh-TW": "重置詳情",
    ja: "リセット詳細",
    ko: "리셋 상세 정보"
  },
  "Affected models": {
    "zh-CN": "涉及模型",
    "zh-TW": "涉及模型",
    ja: "対象モデル",
    ko: "대상 모델"
  },
  "Announced (UTC)": {
    "zh-CN": "公布时间（UTC）",
    "zh-TW": "公布時間（UTC）",
    ja: "発表時刻（UTC）",
    ko: "발표 시각 (UTC)"
  },
  "Interval since previous reset": {
    "zh-CN": "距离上次重置间隔",
    "zh-TW": "距離上次重置間隔",
    ja: "前回リセットからの間隔",
    ko: "이전 리셋 이후 간격"
  },
  "First tracked reset": {
    "zh-CN": "最早收录的重置记录",
    "zh-TW": "最早收錄的重置紀錄",
    ja: "最初に記録されたリセット",
    ko: "최초 기록된 리셋"
  },
  "Source post": {
    "zh-CN": "原始来源",
    "zh-TW": "原始來源",
    ja: "元の投稿",
    ko: "원본 게시물"
  },
  "Previous reset": {
    "zh-CN": "上一次重置",
    "zh-TW": "上一次重置",
    ja: "前回のリセット",
    ko: "이전 리셋"
  },
  "Next reset": {
    "zh-CN": "下一次重置",
    "zh-TW": "下一次重置",
    ja: "次のリセット",
    ko: "다음 리셋"
  },
  "API & Embed": {
    "zh-CN": "API 与徽章嵌入",
    "zh-TW": "API 與徽章嵌入",
    ja: "API・バッジ埋め込み",
    ko: "API 및 배지 임베드"
  },
  "Antigravity Reset — {scope} ({date})": {
    "zh-CN": "Antigravity Reset — {scope}（{date}）",
    "zh-TW": "Antigravity Reset — {scope}（{date}）",
    ja: "Antigravity Reset — {scope}（{date}）",
    ko: "Antigravity Reset — {scope} ({date})"
  },
  "Verified Google Antigravity {scope} announced on {date} by @_mohansolo. View full announcement, interval stats, and open API data.": {
    "zh-CN": "已核实 @_mohansolo 于 {date} 发布的 Google Antigravity {scope}公告。查看完整原文、间隔统计与公开 API 数据。",
    "zh-TW": "已核實 @_mohansolo 於 {date} 發布的 Google Antigravity {scope}公告。查看完整原文、間隔統計與公開 API 資料。",
    ja: "@_mohansolo が {date} に発表した Google Antigravity の{scope}公式記録。全文、リセット間隔統計、公開 API データを確認できます。",
    ko: "@_mohansolo가 {date}에 발표한 Google Antigravity {scope} 공식 기록입니다. 전체 공지 내용, 리셋 간격 통계 및 공개 API 데이터를 확인하세요."
  },
  Home: {
    "zh-CN": "首页",
    "zh-TW": "首頁",
    ja: "ホーム",
    ko: "홈"
  },
  "Reset #{id}": {
    "zh-CN": "重置记录 #{id}",
    "zh-TW": "重置紀錄 #{id}",
    ja: "リセット #{id}",
    ko: "리셋 #{id}"
  }
} as const satisfies Record<string, Record<Exclude<Locale, "en">, string>>;

export type MessageKey = keyof typeof MESSAGES;

export function createTranslator(locale: Locale) {
  return (key: MessageKey, params: Record<string, string | number> = {}): string => {
    const template =
      locale === "en" ? key : (MESSAGES[key]?.[locale as Exclude<Locale, "en">] ?? key);
    return template.replace(/\{(\w+)\}/g, (_, token: string) =>
      token in params ? String(params[token]) : `{${token}}`
    );
  };
}

/** Export the subset of keys needed by client-side interactive scripts. */
export function getClientI18nBundle(locale: Locale): Record<string, string> {
  const t = createTranslator(locale);
  const clientKeys: MessageKey[] = [
    "Switch to dark mode",
    "Switch to light mode",
    "Mohan time",
    "Local time",
    "Switch to Mohan time",
    "Switch to local time",
    "{time} for Mohan",
    "Mohan is probably asleep. Let him dream of quota resets.",
    "Coffee first. Resets later.",
    "Mohan is probably shipping Antigravity right now.",
    "Lunch break. The quotas can wait.",
    "Golden hour in California.",
    "Late night. Just one more deploy…",
    "It's the weekend. Even Mohan touches grass.",
    "just now",
    "Date unavailable",
    "No reset. We persevered.",
    "No reset. He was busy.",
    "No reset. The feed was quiet.",
    "No reset. We refreshed anyway.",
    "No reset. Character-building day.",
    "{count} resets in one day. Feast.",
    "Gemini quota reset",
    "All-model / multi-model reset",
    "Say thanks for the reset",
    "Beg for a reset",
    "thanks",
    "beg",
    "thx",
    "pls",
    "Reset reaction count unavailable",
    "{count} reactions since last reset",
    "browser",
    "browser on",
    "Get browser notifications when Antigravity resets",
    "Stop browser notifications for Antigravity resets",
    "No ping for you: notifications are blocked here.",
    "Deal. The next reset pings you first.",
    "Okay. You'll find out like everyone else.",
    "That didn't take. Please try again.",
    "sending…",
    "email on",
    "You're on the list. We'll notify you when new Antigravity resets land.",
    "That didn't send. Please try again.",
    "Enter a valid email address"
  ];
  const bundle: Record<string, string> = {};
  for (const key of clientKeys) {
    bundle[key] = t(key);
  }
  return bundle;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqStatsSummary {
  total: number;
  avgIntervalDays: string;
  longestWaitDays: string;
}

export function getFaqItems(locale: Locale, stats: FaqStatsSummary): FaqItem[] {
  switch (locale) {
    case "zh-CN":
      return [
        {
          question: "什么是 Antigravity 额度重置（Antigravity Reset）？",
          answer:
            "Antigravity 额度重置是指 Antigravity 团队（通常由 @_mohansolo 在 X 公布）在模型升级、周年纪念、节假日或缓存优化等节点，面向全体或特定档位用户额外清零并恢复使用额度的官方活动，独立于你账号自身的常规滚动刷新周期。"
        },
        {
          question: "Antigravity 额度一般多久重置一次？",
          answer: `根据已收录的 ${stats.total} 次官方重置公告，历史平均重置间隔约为 ${stats.avgIntervalDays} 天，最长一次等待间隔为 ${stats.longestWaitDays} 天。实际重置时间不固定，通常配合重大版本更新或节点事件触发。`
        },
        {
          question: "每次重置涵盖哪些 Antigravity 模型？",
          answer:
            "多数官方重置覆盖 Gemini 模型额度，部分里程碑公告（例如 Antigravity 一周年纪念或早期补偿）还会同时重置 Argon 或全模型（All Models）额度；页面上方的热力图与每条公告标签均会区分“Gemini 常规”与“全模型 / 多模型”。"
        },
        {
          question: "如何第一时间收到下一次 Antigravity 重置通知？",
          answer:
            "你可以点击顶部的“浏览器”开启页面内实时推送、“RSS”订阅 /feed.xml、填写邮箱订阅邮件通知，或直接调用免费的公开 JSON 接口（/api/resets）接入自己的脚本与机器人。"
        }
      ];
    case "zh-TW":
      return [
        {
          question: "什麼是 Antigravity 額度重置（Antigravity Reset）？",
          answer:
            "Antigravity 額度重置是指 Antigravity 團隊（通常由 @_mohansolo 在 X 公布）在模型升級、週年紀念、節假日或快取最佳化等節點，為全體或指定方案使用者額外歸零並恢復使用額度的官方公告，獨立於帳號本身的常規週期刷新。"
        },
        {
          question: "Antigravity 額度通常多久重置一次？",
          answer: `根據目前已收錄的 ${stats.total} 次官方重置公告，歷史平均重置間隔約為 ${stats.avgIntervalDays} 天，最長等待間隔為 ${stats.longestWaitDays} 天。實際時間不固定，通常隨重大模型更新或紀念活動發布。`
        },
        {
          question: "每次重置涵蓋哪些 Antigravity 模型？",
          answer:
            "多數官方重置涵蓋 Gemini 模型額度，部分里程碑公告（例如 Antigravity 一週年紀念）則會同時重置 Argon 或全模型（All Models）額度；頁面上的熱力圖與每則公告標籤皆會標示對應模型範圍。"
        },
        {
          question: "如何第一時間取得下一次 Antigravity 重置通知？",
          answer:
            "你可以點擊頁面上方的「瀏覽器」開啟即時通知、透過「RSS」訂閱 /feed.xml、登記電子郵件提醒，或直接串接免費公開 JSON API（/api/resets）。"
        }
      ];
    case "ja":
      return [
        {
          question: "Antigravity クォータリセット（Antigravity Reset）とは何ですか？",
          answer:
            "Antigravity チーム（主に @_mohansolo が X で発表）がモデルのアップグレードや記念日、キャッシュ改善などのタイミングでユーザー全体の利用枠を特別にリセットする公式アナウンスです。通常ローリング回復とは別枠で行われます。"
        },
        {
          question: "Antigravity のクォータはどのくらいの頻度でリセットされますか？",
          answer: `これまでに記録された ${stats.total} 回の公式リセットに基づく平均間隔は約 ${stats.avgIntervalDays} 日、最長間隔は ${stats.longestWaitDays} 日です。定期スケジュールではなく、大型リリースやイベントに合わせて不定期に実施されます。`
        },
        {
          question: "どのモデル（Gemini・Argon・全モデル）がリセット対象になりますか？",
          answer:
            "多くは Gemini クォータが対象ですが、1周年などの節目や特別なアナウンスでは Argon を含む複数モデルや全モデル（All Models）がリセットされることもあります。履歴グラフと各ログのタグで対象モデルを確認できます。"
        },
        {
          question: "次のリセット通知を受け取るにはどうすればよいですか？",
          answer:
            "ページ上部の「ブラウザ」通知ボタン、RSS フィード（/feed.xml）、メール登録のほか、認証不要の公開 JSON API（/api/resets）をツールや Bot から参照できます。"
        }
      ];
    case "ko":
      return [
        {
          question: "Antigravity 쿼터 리셋(Antigravity Reset)이란 무엇인가요?",
          answer:
            "Antigravity 팀(주로 @_mohansolo의 X 게시물로 공지)이 모델 업그레이드, 출시 기념일, 캐시 성능 개선 등의 시점에 사용자 사용량을 일괄 초기화해 주는 공식 리셋입니다. 계정별 기본 주기 초기화와는 별도로 제공됩니다."
        },
        {
          question: "Antigravity 쿼터는 보통 얼마나 자주 리셋되나요?",
          answer: `현재까지 기록된 ${stats.total}회의 공식 리셋 기준 평균 간격은 약 ${stats.avgIntervalDays}일이며, 최장 대기 간격은 ${stats.longestWaitDays}일입니다. 고정 주기가 아닌 주요 모델 업데이트 및 이벤트에 맞춰 비정기적으로 진행됩니다.`
        },
        {
          question: "어떤 모델(Gemini, Argon, 전체 모델)이 리셋 대상에 포함되나요?",
          answer:
            "대부분 Gemini 쿼터를 대상으로 하며, 1주년 기념 등 주요 공지에서는 Argon을 포함한 다중 모델이나 전체 모델(All Models)이 함께 리셋됩니다. 히트맵과 각 공지 카드의 모델 태그에서 범위를 바로 확인할 수 있습니다."
        },
        {
          question: "다음 리셋 소식을 바로 받아보거나 데이터를 활용할 수 있나요?",
          answer:
            "상단의 브라우저 알림, RSS 피드(/feed.xml), 이메일 구독을 통해 알림을 받을 수 있으며, 별도 키 없이 공개 JSON API(/api/resets)를 자유롭게 연동할 수 있습니다."
        }
      ];
    default:
      return [
        {
          question: "What is an Antigravity quota reset?",
          answer:
            "An Antigravity quota reset is an official bonus quota refill announced by the Antigravity team (tracked from @_mohansolo on X) during model upgrades, anniversaries, holidays, or caching improvements—separate from your normal rolling quota window."
        },
        {
          question: "How often does Antigravity reset usage quotas?",
          answer: `Across ${stats.total} tracked announcements, Antigravity has averaged ${stats.avgIntervalDays} days between resets, with a longest wait of ${stats.longestWaitDays} days. Resets are unscheduled and typically follow major releases or milestones.`
        },
        {
          question: "Which Antigravity models are covered by a reset?",
          answer:
            "Most announcements reset Gemini quota across Antigravity tiers (including Neon, Carbon, and Hydrogen releases), while milestone announcements also reset Argon or all models. Both the heatmap and log cards tag the exact models covered."
        },
        {
          question: "How can I get notified or query Antigravity reset history?",
          answer:
            "Use the browser alert toggle, subscribe via RSS (/feed.xml) or email at the top of the page, or fetch structured JSON directly from the free public API at /api/resets."
        }
      ];
  }
}
