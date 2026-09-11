# K-Muse

**AI 기반 K뷰티 퍼스널 스토리텔링 & 큐레이션 플랫폼**

K뷰티를 처음 접하는 해외 소비자가 낯선 성분명을 마주했을 때, 자신의 피부 이야기(피부타입·고민·상황)를 입력하면 AI가 그 성분이 왜 나에게 맞는지 쉬운 언어로 설명해주고, 이어서 4주 루틴 리포트까지 생성해주는 서비스입니다.

- **배포 URL:** `https://k-muse-pro.vercel.app`
- **서비스 기획서:** `K-Muse_Pro_기획서.docx` 참고

## 소개

- **무료 기능 (Skin Story 진단):** 피부타입 + 주요 고민 + 자유 텍스트 입력 → AI가 K뷰티 성분 2~3개를 추천하고, 왜 이 사람에게 맞는지 개인화된 이유를 생성합니다. 매칭된 브랜드 제휴 슬롯(있는 경우)도 함께 노출됩니다.
- **유료 기능 (4-Week Routine Report):** 무료 진단 결과 + 예산대를 바탕으로 4주치 AM/PM 루틴과 성분 조합 주의사항, 공유용 요약 카드를 생성합니다. 결제는 이 과제 범위에서는 데모(시뮬레이션)로 처리되며, 실제 서비스라면 결제 확인 후 이 API를 호출하도록 확장하면 됩니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | HTML / CSS / JavaScript (Vanilla) |
| Backend | Vercel Serverless Functions (Python) |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) |
| 배포 | Vercel + GitHub 연동 |

## 프로젝트 구조

```
k-muse-pro/
├── index.html          # Hero + 서비스 소개
├── diagnosis.html       # AI 기능 1: Skin Story 진단 (무료)
├── report.html          # AI 기능 2: 4주 루틴 리포트 (유료, 데모 결제)
├── about.html           # 브랜드 파트너 소개 + FAQ + 문의
├── css/style.css
├── js/
│   ├── main.js           # 공통 (모바일 네비게이션)
│   ├── diagnosis.js       # 진단 폼 → /api/diagnose 호출 및 렌더링
│   └── report.js          # 결제 데모 → /api/generate_report 호출 및 렌더링
├── api/
│   ├── diagnose.py         # AI 기능 1 엔드포인트
│   └── generate_report.py  # AI 기능 2 엔드포인트
├── requirements.txt
├── .env.example
└── .gitignore
```

## 로컬 실행 방법

1. 저장소를 클론하고 프로젝트 폴더로 이동합니다.
2. Vercel CLI를 설치합니다.
   ```bash
   npm install -g vercel
   ```
3. `.env.example`을 `.env.local`로 복사하고 실제 API 키를 채웁니다.
   ```bash
   cp .env.example .env.local
   ```
4. 로컬 개발 서버를 실행합니다. (정적 파일과 `api/` 함수를 함께 서빙합니다.)
   ```bash
   vercel dev
   ```
5. 브라우저에서 안내된 로컬 주소(기본값 `http://localhost:3000`)로 접속합니다.

## 배포 방법 (Vercel)

1. GitHub에 이 저장소를 푸시합니다.
2. [vercel.com](https://vercel.com)에서 **Add New → Project**로 이 저장소를 import합니다.
3. **Settings → Environment Variables**에서 아래 값을 등록합니다.
   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | 발급받은 Anthropic API 키 |
4. Deploy를 누르면 `https://<프로젝트명>.vercel.app` 형태의 URL이 발급됩니다.
5. 배포 URL에서 네비게이션 이동, 반응형, AI 기능이 모두 정상 동작하는지 확인합니다.
6. 문제가 있으면 코드를 수정하고 다시 `git push` → Vercel이 자동으로 재배포합니다.

## 환경 변수 (API 키) 관리

- 실제 API 키는 **절대 코드/README/스크린샷에 노출하지 않습니다.**
- 로컬: `.env.local`에 저장 (이미 `.gitignore`에 포함되어 커밋되지 않음)
- 배포: Vercel 대시보드의 Environment Variables에 등록 (코드에서는 `os.environ.get("ANTHROPIC_API_KEY")`로만 접근)
- 키 유출이 의심되면 즉시 Anthropic 콘솔에서 폐기·재발급하고, 커밋 이력에 남아있지 않은지 확인합니다.

## AI 기능의 입력 / 출력 / 실패 처리 기준

### 기능 1: Skin Story 진단 (`/api/diagnose`)
- **입력:** 피부타입, 주요 고민, 자유 텍스트(선택)
- **출력:** 추천 성분 2~3개(영문명, 한글명, 학명, 효과, 개인화된 이유) + 매칭 브랜드 슬롯(있는 경우)
- **실패 처리:**
  - 빈 입력(필수값 누락) → "Please choose a skin type and a main concern."
  - API 오류(4xx/5xx) → "The AI service returned an error. Please try again shortly."
  - 응답 지연(20초 타임아웃) → "This is taking longer than expected. Please try again in a moment."

### 기능 2: 4-Week Routine Report (`/api/generate_report`)
- **입력:** 기능 1의 추천 결과, 예산대
- **출력:** 주차별(1~4주) AM/PM 루틴, 성분 조합 주의사항, 공유용 요약 문구
- **실패 처리:** 기능 1과 동일한 패턴(빈 입력 / API 오류 / 타임아웃 25초)

## 향후 계획 (보너스 방향)

- 실제 결제 연동 (Stripe 또는 국내 PG사)로 `report.html`의 데모 체크아웃 대체
- 브랜드 파트너 슬롯 신청 폼을 Google Sheets/Airtable 등 노코드 저장소와 연동
- 다국어 지원(영어 → 일본어/중국어) 및 다크 모드
