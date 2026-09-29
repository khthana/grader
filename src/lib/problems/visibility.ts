// What a Student may see of a Problem (#71). Hidden Test Cases are run at
// submit time but never shown (PRD.md #22), and the unit-test block is the
// grader's answer key — both are stripped before anything leaves the server.
export function studentProblemView<
  T extends { testCases: Array<{ isHidden: boolean }>; unitTestCode: string },
>(problem: T): Omit<T, "unitTestCode"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { unitTestCode, ...rest } = problem
  return { ...rest, testCases: problem.testCases.filter((tc) => !tc.isHidden) }
}
