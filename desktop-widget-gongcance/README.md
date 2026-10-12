# 공캉스 데스크톱 위젯

공부하다 쉬는 시간을 재는 스터디 브레이크 스톱워치 위젯입니다.

## 다운로드

| 운영체제 | 링크 |
|---|---|
| 윈도우 | [gongcance-widget-1.0.15.exe](https://github.com/yenihong/hwacance-web/releases/download/gongcance-v1.0.15/gongcance-widget-1.0.15.exe) |
| 맥 (M1 이후·인텔 공용) | [gongcance-widget-1.0.15-mac.dmg](https://github.com/yenihong/hwacance-web/releases/download/gongcance-v1.0.15/gongcance-widget-1.0.15-mac.dmg) |

### 맥에서 설치하기
1. `.dmg`를 열고 **공캉스 위젯**을 응용 프로그램 폴더로 끌어다 놓습니다.
2. 처음 열 때 "확인되지 않은 개발자" 경고가 뜨면 **시스템 설정 → 개인정보 보호 및 보안**에서 **"그래도 열기"**를 누릅니다. (애플 개발자 인증서로 서명하지 않은 앱이라 처음 한 번만 필요해요.)
3. 실행하면 화면 오른쪽 아래에 위젯이, 화면 위 메뉴 막대에 아이콘이 생깁니다. 맥에서는 Dock에 나타나지 않고 메뉴 막대 아이콘으로만 존재해요(윈도우의 트레이 아이콘과 같은 역할).

### 새 버전 배포하기
`package.json`의 `version`을 올리고 GitHub에서 `gongcance-v<버전>` 태그로 릴리스를 만들면, GitHub Actions가 윈도우 `.exe`와 맥 `.dmg`를 빌드해서 그 릴리스에 자동으로 올립니다. 이미 있는 릴리스에 파일만 추가하려면 Actions 탭 → **desktop-widget build** → **Run workflow**에서 태그 이름을 넣으면 돼요.

## 직접 빌드하기

[Node.js](https://nodejs.org) LTS를 설치한 뒤 이 폴더에서:

```bash
npm install
npm start          # 바로 실행해보기
npm run build      # 윈도우 .exe (윈도우 PC에서)
npm run build:mac  # 맥 .dmg (맥에서)
```
