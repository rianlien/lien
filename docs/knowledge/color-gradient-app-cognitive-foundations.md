# 色グラデーションアプリ — 背景知識（認知科学・哲学の発想元）

`docs/knowledge/color-gradient-app-color-science.md` が色科学・Mesh Gradient技術という実装側の背景知識をまとめたのに対し、本ドキュメントは**プロダクトコンセプトそのものの発想元**になった認知科学・哲学の概念群をまとめる。発想元である旨は
[docs/raw-rfp/color-gradient-app.md](../raw-rfp/color-gradient-app.md)の「発想の元ネタになった認知科学・哲学の概念群」に human input として記録されている。

各概念は一般的な学術知識であり、このプロダクト固有の設計判断ではない。どのraw-rfpの記述と対応するかを都度示す。

## 自分は他者を通してしか完全にはわからない、という枠組み

**raw-rfp対応**: 「自分から見た自分と他人から見た自分って違って当たり前でそれがあって初めて自分というものがある」「完全な状態を理解するって多分無理」（[raw-rfp: 動機の核・受容](../raw-rfp/color-gradient-app.md)）

- **Theory of Mind（心の理論）**: 他者の信念・意図・視点を推論する能力。認知科学では、エージェントが「自分の内部状態」「他者の内部状態」「外界（物）」を区別して表現することがTheory of Mindの前提とされる。
  - [A Brain-Inspired Model of Theory of Mind — Frontiers](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2020.00060/full)
- **World Model / Self Model / Other Model**: 認知エージェントは「外界がどうなっているかのモデル（World Model）」「自分自身がどういう存在かのモデル（Self Model）」「他者がどういう存在かのモデル（Other Model）」を別々に持つ、という整理。このアプリでは、発起人が友達を2D空間に配置する行為が発起人の中の「Other Model」（自分にとって各友達がどんな存在か）にあたり、友達が返す色は各友達の中の「発起人についてのOther Model」（自分が発起人からどう見えているか、発起人にどう見せたいか）にあたる。両者は独立に更新され、一致しないことが前提とされている点が、このアプリが「診断」ではなく「複数のOther Modelの並置」である理由。
  - [Toward AI That Understands Self and Others: A World-Model Theory of Cognitive Diversity and Alignment](https://arxiv.org/pdf/2605.29930)
- **Phenomenology（現象学）／間主観性（intersubjectivity）**: Merleau-Pontyは、他者の知覚は単なる「物体としての身体の観察」ではなく、間主観的な関係の中で構成されると論じた。自分という存在は、他者との関係の中でしか立ち上がらないという立場は、「自己評価だけだと自分じゃなくて」というraw-rfpの発言と直接対応する。
  - [What Is Merleau-Ponty's Phenomenology of Perception? — TheCollector](https://www.thecollector.com/merleau-ponty-phenomenology-perception/)
- **Umwelt（環世界、Jakob von Uexküll）**: 生物ごとに、感覚器官が拾える情報だけで構成された固有の主観的世界がある、という概念。同じ客観的環境にいても、個体ごとに異なる「見え方」の中で生きている。raw-rfpの「光が変わると色も変わる、人もそうなのかな」は、この「同じ対象でも見る側の条件によって立ち上がる印象が変わる」というUmwelt的な発想と同型。
  - [Umwelt — Wikipedia](https://en.wikipedia.org/wiki/Umwelt)

## 色を通じて他者の印象を受け取る

**raw-rfp対応**: 「私を色で表すなら？」「理由も性格も説明も不要。直感で選んでもらう」（[raw-rfp: コンセプト全体](../raw-rfp/color-gradient-app.md)）

- **Impression Formation（印象形成）**: 断片的な情報から他者についての全体的な印象を統合する過程。Aschの研究では、情報の与え方（順序・central trait）が印象を大きく左右することが示された。このアプリは「色」という一次元（に見えて実は多次元）の情報だけで印象を圧縮させる設計であり、Impression Formation研究が扱う「限られた情報からどう全体像が作られるか」そのものを一枚のアートに固定する試みと言える。
  - [Impression formation — Wikipedia](https://en.wikipedia.org/wiki/Impression_formation)
- **Social Perception（社会的知覚）**: 他者の特性・感情・意図を、表情や振る舞いなどの手がかりから知覚する過程全般。色選択という手がかりに絞ることで、通常のSocial Perceptionが使う多くのチャンネル（表情・声・言葉）を意図的に一つに削っている。
- **Color Psychology（色彩心理学）**: 色が学習された連想や生得的な連想を通じて特定の感情・意味を喚起するという立場。色を選ぶ側の内的な連想が回答色に反映される、という前提を支える。
  - [Color psychology — Wikipedia](https://en.wikipedia.org/wiki/Color_psychology)
- **Color Semantics（色彩の意味論）**: 色の意味を言語・文化的な概念化として捉える言語学的な立場（Color Psychologyが個人内の連想に注目するのに対し、Color Semanticsは色名・色概念が言語・文化によってどう意味づけられるかを扱う）。「友達が選んだ色」を発起人がどう解釈するかには、この文化的な意味づけの層も関わる。
  - [The meaning of color terms: Semantics, culture, and cognition — Wierzbicka](https://www.researchgate.net/publication/249926957_The_meaning_of_color_terms_Semantics_culture_and_cognition)
- **Synesthesia（共感覚）**: 本来別の感覚モダリティに属する刺激（数字・音・文字など）が、自動的に色の知覚を伴う現象。このアプリの核である「人という抽象的・多感覚的な印象を、色という単一モダリティに写す」行為は、真の共感覚（自動的・非意図的）ではないが、同じ構造（あるモダリティの情報を別モダリティにマッピングする）を意図的・意識的に行わせる設計だと整理できる。
  - [Cross-modal associations and synesthesia — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6691033/)

## 自分の中の関係性を空間に置く

**raw-rfp対応**: 「この人とこの人は近い」「この人はこの辺なんだよな」という感覚で友達を2D空間に配置する（[raw-rfp: 自分の中にある人間関係を配置する](../raw-rfp/color-gradient-app.md)）

- **Cognitive Map（認知地図、Tolman）**: 空間的な環境についての内的な地図表現。ランドマークや位置関係、それに付随する感情的な連想までも含む。発起人が友達を配置する2D平面は、物理空間ではなく人間関係についてのCognitive Mapの外部化と言える。
  - [Cognitive map — Wikipedia](https://en.wikipedia.org/wiki/Cognitive_map)
- **Similarity Space（類似性空間、Shepard）**: 「近い/遠い」という類似性判断を、多次元尺度構成法（MDS）によって幾何的な空間に埋め込む手法・理論。raw-rfpの「近い」「この辺」という表現は、まさにSimilarity Spaceの言葉そのもの。
  - [Using multidimensional scaling to quantify similarity in visual search and beyond](https://pmc.ncbi.nlm.nih.gov/articles/PMC5523409/)
- **Conceptual Spaces（概念空間、Gärdenfors）**: 色・重さ・音高のような「質的次元（quality dimensions）」からなる幾何空間として概念を表現する理論。空間内の点が対象、領域が概念（プロトタイプに近いほど代表的）にあたる。このアプリの2D配置平面（関係性の空間）とMesh Gradientの色空間（色の混色）は、どちらもConceptual Spacesの発想——「質を幾何として扱う」——の具体例になっている。
  - [Conceptual space — Wikipedia](https://en.wikipedia.org/wiki/Conceptual_space)
- **Mental Model（メンタルモデル）**: 外界の仕組みについて個人が持つ、簡略化された内的表現。友達の配置・色の見せ方の一つ一つが、発起人の「この人はこういう人だ」というメンタルモデルの写しになる。

## 複数の印象が混ざり合う過程（比喩）

**raw-rfp対応**: 「色を平均しないこと」「温度感とか彩度とか透明感みたいな部分が人間の印象として入ってる」（[raw-rfp: 「色を平均しないこと」の定義](../raw-rfp/color-gradient-app.md)）

- **Activation Graph（活性化グラフ／spreading activation）**: 記憶内の概念をノード、連想の強さをエッジの重みとして表現し、一つのノードの活性化が重みに応じて隣接ノードに伝播するという認知心理学のモデル。直接この技術を実装で使っているわけではないが、「複数の友達からの色（＝複数のノードの活性化）が単純な平均ではなく、関係性の重み（このアプリでは空間的な距離＝reach）に応じて非線形に混ざり合う」という設計思想の比喩的な参照元になっている。[docs/knowledge/color-gradient-app-color-science.md](color-gradient-app-color-science.md)のガウシアン距離減衰による重み付け混色は、技術的には全く別の実装だが、「近さに応じて影響が伝播する」という構造はActivation Graphの発想と相似している。
  - [Spreading activation — Wikipedia](https://en.wikipedia.org/wiki/Spreading_activation)

## 位置づけの注意

上記はいずれも「このプロダクトが何にインスパイアされているか」という発想の系譜であり、実装がこれらの理論を厳密に実装している（例えばMDSアルゴリズムやspreading activationのアルゴリズムを実装で使っている）という意味ではない。実装の技術選択とその理由は[docs/internal-design/color-gradient-app.md](../internal-design/color-gradient-app.md)、技術要素そのものの背景は[docs/knowledge/color-gradient-app-color-science.md](color-gradient-app-color-science.md)を参照。
