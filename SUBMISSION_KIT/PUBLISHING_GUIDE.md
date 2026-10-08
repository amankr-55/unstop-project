# Step-by-Step Publishing & Unstop Submission Guide

Follow these exact steps to complete your submission for the **Build for AI Agents: LLM SkillHub Challenge 2026**:

---

### Step 1: Publish Your Skill on LLM SkillHub (Mandatory)

1. Go to [https://llmskillhub.com](https://llmskillhub.com).
2. Click **Sign In** and log in using your **Google** or **GitHub** account.
   > ⚠️ **IMPORTANT**: Note down the email address you use here. You must provide this exact same email on the Unstop registration form so the organizers can link your submission!
3. Click **Create Skill** (or **New Skill**).
4. Fill in the Skill details:
   - **Skill Name:** `bharat-gst-sentinel`
   - **Title / Tagline:** Autonomous Indian GST Compliance Auditor & GSTR-2B Reconciler
   - **Visibility:** Set to **PUBLIC** (Do NOT leave as Private; private skills cannot be judged!).
5. In the skill content editor, copy and paste the entire contents of `SKILL.md`.
6. Upload or attach the supporting files if prompted:
   - `scripts/gst_engine.js` (or `.py`)
   - `scripts/gstr2b_reconciler.js` (or `.py`)
   - `references/state_codes.json`
   - `references/gst_slabs.json`
7. Click **Publish**.
8. Copy your skill's public URL (e.g., `https://llmskillhub.com/skills/your-username/bharat-gst-sentinel`).

---

### Step 2: Push to GitHub (For Evals & Public Repository)

If you haven't already initialized git:
```bash
git init
git add .
git commit -m "feat: initial release of bharat-gst-sentinel skill"
# Push to your GitHub account
# git remote add origin https://github.com/<your-username>/bharat-gst-sentinel.git
# git push -u origin main
```
Your GitHub repository link will serve as your **Eval Link** and public codebase reference!

---

### Step 3: Record Your 2-Minute Demo Video (Optional but recommended for Top 10)

1. Open `SUBMISSION_KIT/DEMO_SCRIPT.md`.
2. Use **Loom**, **OBS Studio**, or Windows Game Bar (`Win + Alt + R`) to record your screen for ~100–120 seconds.
3. Show:
   - How a normal agent fails at GST checksums and jurisdiction.
   - How running `bharat-gst-sentinel` achieves 100% accuracy in 15ms.
   - The GSTR-2B ITC reconciliation table.
   - The evaluation benchmark scorecard.
4. Upload the video to **YouTube (Unlisted/Public)** or **Loom**, and copy the shareable link.

---

### Step 4: Submit on Unstop (Deadline: 26 Oct 2026, 11:59 PM IST)

Go to the challenge page on Unstop and paste the following into the submission form:

1. **Public Skill URL:**  
   `https://llmskillhub.com/skills/<your-username>/bharat-gst-sentinel`
2. **Short Write-Up (Max 500 words):**  
   Copy and paste the exact text from `SUBMISSION_KIT/UNSTOP_WRITEUP.md` (Total 445 words).
3. **User Feedback:**  
   Copy and paste the summary and quotes from `SUBMISSION_KIT/USER_FEEDBACK.md`.
4. **Eval Link and Results (Optional):**  
   Paste your GitHub repository link and copy the benchmark summary table from `evals/EVAL_SCORECARD.md`.
5. **Demo Video Link (Optional):**  
   Paste your YouTube or Loom link.
6. Click **Submit**! 🎉
