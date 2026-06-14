// ============ CE-Grader Student ============
const STATE_BADGE = {
  graded: ["green", "ตรวจแล้ว"],
  submitted: ["blue", "ส่งแล้ว · รอตรวจ"],
  todo: ["amber", "ยังไม่ส่ง"],
};

function StudentHome({ onOpen }) {
  const done = STUDENT_ASSIGNMENTS.filter((a) => a.state !== "todo").length;
  const total = STUDENT_ASSIGNMENTS.length;
  const myScore = STUDENT_ASSIGNMENTS.reduce((a, x) => a + (x.score || 0), 0);
  const maxScore = STUDENT_ASSIGNMENTS.reduce((a, x) => a + x.points, 0);
  return (
    <div className="page">
      <div className="welcome welcome-student">
        <div>
          <div className="welcome-hi">สวัสดี, {STUDENT_ME.name.split(" ")[0]}</div>
          <h1 className="welcome-name">{COURSE.nameTh}</h1>
          <p className="welcome-sub">{COURSE.code} · {COURSE.name}</p>
        </div>
      </div>
      <div className="stat-grid">
        <Card className="stat-card"><div className="stat-ic stat-blue"><Icon name="code" size={22} /></div>
          <div><div className="stat-val">{done}/{total}</div><div className="stat-label">งานที่ส่งแล้ว</div></div></Card>
        <Card className="stat-card"><div className="stat-ic stat-orange"><Icon name="clock" size={22} /></div>
          <div><div className="stat-val">{total - done}</div><div className="stat-label">งานที่ค้าง</div></div></Card>
        <Card className="stat-card"><div className="stat-ic stat-green"><Icon name="chart" size={22} /></div>
          <div><div className="stat-val">{myScore}<i className="stat-of">/{maxScore}</i></div><div className="stat-label">คะแนนสะสม</div></div></Card>
      </div>
      <Card className="pad">
        <div className="card-head"><h3 className="card-title">งานที่ต้องทำต่อ</h3></div>
        <ul className="mini-list">
          {STUDENT_ASSIGNMENTS.filter((a) => a.state === "todo").map((a) => (
            <li key={a.id}>
              <div><b>{a.no}. {a.title}</b><span className="mini-meta">กำหนดส่ง {a.due} · {a.points} คะแนน</span></div>
              <Button size="sm" onClick={() => onOpen(a)}>เริ่มทำ</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StudentWork({ onOpen }) {
  const [week, setWeek] = useState(1);
  const weekInfo = WEEKS.find((w) => w.no === week);
  const rows = STUDENT_ASSIGNMENTS.filter((a) => a.week === week);
  return (
    <div className="page">
      <PageHead title="งานที่ได้รับมอบหมาย" sub={`${COURSE.code} · ${COURSE.nameTh}`} />
      <WeekBar weeks={WEEKS} value={week} onChange={setWeek} />
      <Card className="pad">
        <div className="section-head">
          <h3 className="card-title">สัปดาห์ที่ {week} · {weekInfo.topic}</h3>
          <span className="muted">{rows.length} งาน</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 56 }}>ลำดับ</th><th>ชื่อโจทย์</th><th>กำหนดส่ง</th>
              <th>คะแนนเต็ม</th><th>สถานะ</th><th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const [tone, label] = STATE_BADGE[a.state];
              return (
                <tr key={a.id}>
                  <td className="muted">{i + 1}</td>
                  <td><b>{a.title}</b></td>
                  <td className="muted nowrap">{a.due}</td>
                  <td className="mono">{a.points}</td>
                  <td><Badge kind={tone} dot>{label}{a.state === "graded" && a.score != null ? ` · ${a.score}/${a.points}` : ""}</Badge></td>
                  <td><div className="row-actions">
                    <Button size="sm" variant={a.state === "todo" ? "primary" : "outline"} onClick={() => onOpen(a)}>
                      {a.state === "todo" ? "ทำโจทย์" : "ดูงาน"}
                    </Button>
                  </div></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="empty-row">ยังไม่มีงานในสัปดาห์นี้</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Solve: split editor ----------
const STARTER = `# เขียนโค้ดของคุณที่นี่
n = int(input())
nums = list(map(int, input().split()))

`;

function StudentSolve({ assignment, layout, onBack }) {
  const problem = PROBLEMS.find((p) => p.no === assignment.no) || PROBLEMS[0];
  const [code, setCode] = useState(STARTER);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [submitted, setSubmitted] = useState(assignment.state !== "todo");
  const [tab, setTab] = useState("editor");
  const taRef = useRef(null);

  const visibleTests = problem.tests.filter((t) => !t.hidden);

  const run = (isSubmit) => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const passAll = code.includes("% 2 == 0") || code.includes("%2==0");
      const tests = (isSubmit ? problem.tests : visibleTests).map((t, i) => ({
        no: i + 1, hidden: t.hidden, score: t.score,
        pass: passAll, input: t.input, expected: t.output,
        got: passAll ? t.output : "—", time: (7 + i * 2) + " ms",
      }));
      setResults({ tests, isSubmit, passAll });
      setRunning(false);
      if (isSubmit) setSubmitted(true);
    }, 900);
  };

  const onKey = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target, s = el.selectionStart, en = el.selectionEnd;
      const nv = code.slice(0, s) + "    " + code.slice(en);
      setCode(nv);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
    }
  };

  const ProblemPane = (
    <div className="solve-problem">
      <div className="sp-head">
        <span className="sp-no">โจทย์ {problem.no}</span>
        <span className="sp-pts">{problem.points} คะแนน</span>
      </div>
      <h2 className="sp-title">{problem.title}</h2>
      <p className="sp-desc">{problem.desc}</p>
      <div className="sp-block"><h4>รูปแบบ Input</h4><pre>{problem.inputSpec}</pre></div>
      <div className="sp-block"><h4>รูปแบบ Output</h4><pre>{problem.outputSpec}</pre></div>
      <div className="sp-examples">
        <h4>ตัวอย่าง</h4>
        {visibleTests.map((t, i) => (
          <div className="sp-ex" key={i}>
            <div><span>Input</span><pre>{t.input}</pre></div>
            <div><span>Output</span><pre>{t.output}</pre></div>
          </div>
        ))}
      </div>
    </div>
  );

  const EditorPane = (
    <div className="solve-editor">
      <div className="se-bar">
        <span className="se-lang"><Icon name="code" size={15} /> Python 3.11</span>
        <div className="se-actions">
          <Button variant="outline" size="sm" icon="play" onClick={() => run(false)} disabled={running}>รันทดสอบ</Button>
          <Button size="sm" icon="upload" onClick={() => run(true)} disabled={running}>ส่งคำตอบ</Button>
        </div>
      </div>
      <div className="se-code">
        <div className="se-gutter">{code.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div>
        <textarea ref={taRef} spellCheck={false} value={code} onKeyDown={onKey}
          onChange={(e) => setCode(e.target.value)} className="se-textarea" />
      </div>
      <div className="se-output">
        {running && <div className="se-running"><span className="spinner" /> กำลังรันโค้ดและตรวจ Test Case…</div>}
        {!running && !results && <div className="se-idle"><Icon name="play" size={16} /> กด “รันทดสอบ” เพื่อตรวจกับตัวอย่าง หรือ “ส่งคำตอบ” เพื่อส่งจริง</div>}
        {!running && results && (
          <div className="se-results">
            <div className={`se-verdict ${results.passAll ? "ok" : "bad"}`}>
              <Icon name={results.passAll ? "check" : "x"} size={17} stroke={3} />
              {results.isSubmit
                ? (results.passAll ? `ผ่านทุกเคส! ได้ ${problem.points}/${problem.points} คะแนน` : "ยังไม่ผ่านทุกเคส — ลองแก้แล้วส่งใหม่")
                : (results.passAll ? "ผ่านตัวอย่างทั้งหมด" : "ยังไม่ผ่านตัวอย่าง")}
            </div>
            {results.tests.map((r) => (
              <div key={r.no} className={`se-test ${r.pass ? "pass" : "fail"}`}>
                <span className="set-ic"><Icon name={r.pass ? "check" : "x"} size={12} stroke={3} /></span>
                <span className="set-name">Test #{r.no}{r.hidden && <i> (ซ่อน)</i>}</span>
                <span className="set-time">{r.time}</span>
                <span className="set-score">{r.pass ? r.score : 0}/{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="page page-solve">
      <div className="solve-top">
        <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /> กลับไปงานที่ได้รับ</button>
        {submitted && <Badge kind="green" dot>ส่งแล้ว</Badge>}
      </div>
      {layout === "tabs" && (
        <div className="solve-tabs">
          <button className={tab === "problem" ? "active" : ""} onClick={() => setTab("problem")}><Icon name="doc" size={16} /> โจทย์</button>
          <button className={tab === "editor" ? "active" : ""} onClick={() => setTab("editor")}><Icon name="code" size={16} /> เขียนโค้ด</button>
        </div>
      )}
      <div className={`solve-body solve-${layout}`} data-tab={tab}>
        {ProblemPane}
        {EditorPane}
      </div>
    </div>
  );
}

// ---------- Student scorebook (own only) ----------
function StudentScores() {
  const me = SCOREBOOK[0];
  const probs = PROBLEMS;
  const total = me.scores.reduce((a, v) => a + (v || 0), 0);
  const maxTotal = probs.reduce((a, p) => a + p.points, 0);
  return (
    <div className="page">
      <PageHead title="สมุดคะแนนของฉัน" sub={`${STUDENT_ME.sid} · ${STUDENT_ME.name}`} />
      <div className="my-score-banner">
        <div className="msb-ring">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="ring-bg" />
            <circle cx="40" cy="40" r="34" className="ring-fg"
              style={{ strokeDasharray: 2 * Math.PI * 34, strokeDashoffset: 2 * Math.PI * 34 * (1 - total / maxTotal) }} /></svg>
          <div className="msb-ring-num">{Math.round((total / maxTotal) * 100)}<i>%</i></div>
        </div>
        <div className="msb-meta">
          <div className="msb-total">{total}<i> / {maxTotal} คะแนน</i></div>
          <div className="msb-sub">ทำได้ {me.scores.filter((v) => v != null).length} จาก {probs.length} โจทย์</div>
        </div>
      </div>
      <Card className="pad">
        <table className="tbl">
          <thead><tr><th style={{ width: 56 }}>โจทย์</th><th>ชื่อโจทย์</th><th>สถานะ</th><th>คะแนนที่ได้</th><th>เต็ม</th></tr></thead>
          <tbody>
            {probs.map((p, i) => {
              const v = me.scores[i];
              return (
                <tr key={p.id}>
                  <td className="muted">{p.no}</td>
                  <td><b>{p.title}</b></td>
                  <td>{v == null ? <Badge kind="amber" dot>ยังไม่ส่ง</Badge> : <Badge kind="green" dot>ตรวจแล้ว</Badge>}</td>
                  <td>{v == null ? <span className="muted">–</span> : <b className="score-num">{v}</b>}</td>
                  <td className="muted">{p.points}</td>
                </tr>
              );
            })}
            <tr className="tbl-sumrow">
              <td colSpan={3}></td><td><b>{total}</b></td><td className="muted">{maxTotal}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

Object.assign(window, { StudentHome, StudentWork, StudentSolve, StudentScores });
