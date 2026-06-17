// ============ CE-Grader Teacher: Grading + Scorebook ============

// ---------- Code viewer with line numbers ----------
function CodeView({ code, lang }) {
  const lines = code.split("\n");
  return (
    <div className="codeview">
      <div className="cv-bar">
        <span className="cv-dots"><i /><i /><i /></span>
        <span className="cv-name">solution.py</span>
        <span className="cv-lang">{lang}</span>
      </div>
      <div className="cv-body">
        <div className="cv-gutter">{lines.map((_, i) => <span key={i}>{i + 1}</span>)}</div>
        <pre className="cv-code">{lines.map((l, i) => <div key={i} className="cv-line">{hl(l)}</div>)}</pre>
      </div>
    </div>
  );
}
// tiny python syntax highlighter
function hl(line) {
  const kw = /\b(def|return|for|in|if|else|elif|while|int|str|list|map|print|input|and|or|not|range|len|sum|True|False|None)\b/g;
  const parts = [];
  let last = 0, m;
  const re = new RegExp(kw);
  // comments
  const ci = line.indexOf("#");
  const codePart = ci >= 0 ? line.slice(0, ci) : line;
  const comment = ci >= 0 ? line.slice(ci) : "";
  while ((m = re.exec(codePart))) {
    if (m.index > last) parts.push(codePart.slice(last, m.index));
    parts.push(<span key={m.index} className="tok-kw">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < codePart.length) parts.push(codePart.slice(last));
  if (comment) parts.push(<span key="c" className="tok-com">{comment}</span>);
  return parts.length ? parts : "\u00a0";
}

// ---------- Test results from a submission ----------
function buildResults(problem, sub) {
  return problem.tests.map((t, i) => {
    const pass = i < sub.pass;
    return {
      no: i + 1, hidden: t.hidden, pass, score: t.score,
      input: t.input, expected: t.output,
      got: pass ? t.output : (t.output === "6" ? "9" : t.output === "20" ? "20" : "—"),
      time: (8 + i * 3) + " ms",
    };
  });
}

function TeacherGrade() {
  const problem = PROBLEMS[0];
  const [subs, setSubs] = useState(SUBMISSIONS);
  const [sel, setSel] = useState(SUBMISSIONS[0].id);
  const cur = subs.find((s) => s.id === sel);
  const results = buildResults(problem, cur);
  const passCount = results.filter((r) => r.pass).length;

  const updateCur = (patch) => setSubs(subs.map((s) => (s.id === sel ? { ...s, ...patch } : s)));

  return (
    <div className="page page-grade">
      <PageHead title="ตรวจงาน" sub={`${problem.title} · ${COURSE.nameTh}`}
        actions={<div className="select-wrap">
          <select defaultValue={problem.id}>{PROBLEMS.map((p) => <option key={p.id} value={p.id}>{p.no}. {p.title}</option>)}</select>
          <Icon name="chevD" size={15} />
        </div>} />

      <div className="grade-layout">
        {/* queue */}
        <Card className="grade-queue">
          <div className="gq-head">รายการส่งงาน <span>{subs.length}</span></div>
          <div className="gq-list">
            {subs.map((s) => (
              <button key={s.id} className={`gq-item${s.id === sel ? " active" : ""}`} onClick={() => setSel(s.id)}>
                <Avatar name={s.name} size={32} tone="orange" />
                <div className="gq-meta">
                  <div className="gq-name">{s.name}</div>
                  <div className="gq-sid">{s.sid}</div>
                </div>
                {s.status === "graded"
                  ? <Badge kind="green" dot>ตรวจแล้ว</Badge>
                  : <Badge kind="amber" dot>รอตรวจ</Badge>}
              </button>
            ))}
          </div>
        </Card>

        {/* code + results */}
        <div className="grade-center">
          <CodeView code={cur.code} lang={cur.lang} />
          <Card className="pad results-card">
            <div className="card-head">
              <h3 className="card-title">ผลการตรวจอัตโนมัติ</h3>
              <Badge kind={passCount === results.length ? "green" : "amber"} dot>
                ผ่าน {passCount}/{results.length} เคส
              </Badge>
            </div>
            <div className="results">
              {results.map((r) => (
                <div key={r.no} className={`result${r.pass ? " pass" : " fail"}`}>
                  <div className="rs-head">
                    <span className="rs-ic"><Icon name={r.pass ? "check" : "x"} size={14} stroke={3} /></span>
                    <span className="rs-title">Test Case #{r.no}{r.hidden && <i className="rs-hidden">ซ่อน</i>}</span>
                    <span className="rs-time">{r.time}</span>
                    <span className="rs-score">{r.pass ? r.score : 0}/{r.score}</span>
                  </div>
                  {!r.pass && (
                    <div className="rs-detail">
                      <div><span>Input</span><code>{r.input.replace(/\n/g, " ⏎ ")}</code></div>
                      <div><span>คาดหวัง</span><code className="ok">{r.expected}</code></div>
                      <div><span>ได้</span><code className="bad">{r.got}</code></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* grading panel */}
        <Card className="grade-panel">
          <div className="gp-student">
            <Avatar name={cur.name} size={40} tone="orange" />
            <div><div className="gp-name">{cur.name}</div><div className="gp-sid">{cur.sid}</div></div>
            {cur.status === "graded" ? <Badge kind="green" dot>ตรวจแล้ว</Badge> : <Badge kind="amber" dot>รอตรวจ</Badge>}
          </div>
          <div className="gp-meta">
            <div><Icon name="clock" size={15} /> ส่งเมื่อ {cur.at}</div>
            <div><Icon name="code" size={15} /> {cur.lang}</div>
          </div>

          <div className="gp-score">
            <div className="gp-score-row">
              <span>คะแนนอัตโนมัติ (Test Case)</span>
              <b className="gp-auto">{cur.auto}<i>/{problem.points}</i></b>
            </div>
            <div className="gp-bar"><div style={{ width: `${(cur.auto / problem.points) * 100}%` }} /></div>
          </div>

          <Field label="คะแนนพิเศษจากอาจารย์ (Bonus)" hint="เช่น คุณภาพโค้ด / ประสิทธิภาพ">
            <div className="stepper">
              <button onClick={() => updateCur({ bonus: Math.max(0, cur.bonus - 1) })}><Icon name="x" size={14} stroke={3} /></button>
              <input type="number" value={cur.bonus} onChange={(e) => updateCur({ bonus: Number(e.target.value) })} />
              <button onClick={() => updateCur({ bonus: cur.bonus + 1 })}><Icon name="plus" size={14} stroke={3} /></button>
            </div>
          </Field>

          <div className="gp-total">
            <span>คะแนนรวม</span>
            <b>{cur.auto + cur.bonus}<i> คะแนน</i></b>
          </div>

          <Field label="ความคิดเห็นถึงนักศึกษา">
            <textarea rows={3} placeholder="ให้ feedback แก่นักศึกษา…" defaultValue={cur.status === "graded" ? "โค้ดอ่านง่ายและถูกต้องครบทุกเคส เยี่ยมมาก" : ""} />
          </Field>

          <Button onClick={() => updateCur({ status: "graded" })} icon="check">
            {cur.status === "graded" ? "บันทึกการแก้ไข" : "บันทึกผลการตรวจ"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

// ---------- Scorebook (teacher: everyone) ----------
function TeacherScores() {
  const probs = PROBLEMS;
  const totalMax = probs.reduce((a, p) => a + p.points, 0);
  return (
    <div className="page">
      <PageHead title="สมุดคะแนน" sub={`${COURSE.code} · ${COURSE.nameTh}`}
        actions={<Button variant="outline" size="sm" icon="download">ส่งออก Excel</Button>} />
      <Card className="pad">
        <div className="legend">
          <span><i className="lg green" /> ส่งแล้ว</span>
          <span><i className="lg amber" /> ส่งช้า</span>
          <span><i className="lg red" /> ค้างส่ง</span>
        </div>
        <div className="table-scroll">
          <table className="tbl tbl-scores">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>รหัสนักศึกษา</th><th>ชื่อ - นามสกุล</th><th style={{ width: 70 }}>สถานะ</th>
                {probs.map((p) => <th key={p.id} className="th-prob"><div>{p.title}</div><span>{p.points} คะแนน</span></th>)}
                <th className="th-total">รวม<span>{totalMax} คะแนน</span></th>
              </tr>
            </thead>
            <tbody>
              {SCOREBOOK.map((row) => {
                const total = row.scores.reduce((a, v) => a + (v || 0), 0);
                const stTone = row.status === "ส่งแล้ว" ? "green" : row.status === "ส่งช้า" ? "amber" : "red";
                return (
                  <tr key={row.sid}>
                    <td className="muted">{row.rank}</td>
                    <td className="mono">{row.sid}</td>
                    <td><b>{row.name}</b></td>
                    <td><span className={`status-dot ${stTone}`} title={row.status} /></td>
                    {row.scores.map((v, i) => (
                      <td key={i} className="td-score">
                        {v == null ? <span className="sc-empty">–</span>
                          : <span className={`sc-pill ${v >= probs[i].points * 0.8 ? "hi" : v >= probs[i].points * 0.5 ? "mid" : "lo"}`}>{v}</span>}
                      </td>
                    ))}
                    <td className="td-total"><b>{total}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={1} pages={1} onPage={() => {}} total={SCOREBOOK.length} shown={SCOREBOOK.length} />
      </Card>
    </div>
  );
}

Object.assign(window, { TeacherGrade, TeacherScores, CodeView, buildResults });
