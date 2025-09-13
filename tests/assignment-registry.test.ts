import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, principalCV, buffCV, uintCV } from "@stacks/transactions";

const ERR_COURSE_NOT_FOUND = 100;
const ERR_DUPLICATE_ASSIGNMENT = 101;
const ERR_UNAUTHORIZED = 102;
const ERR_INVALID_HASH = 103;
const ERR_INVALID_TITLE = 104;
const ERR_INVALID_STUDENT_ID = 105;
const ERR_INVALID_COURSE_ID = 106;
const ERR_ASSIGNMENT_NOT_FOUND = 107;
const ERR_PAST_TIMESTAMP = 108;
const ERR_MAX_ASSIGNMENTS_EXCEEDED = 109;
const ERR_INVALID_METADATA = 110;
const ERR_NOTIFICATION_FAILED = 111;
const ERR_AUDIT_LOG_FAILED = 112;
const ERR_TIMESTAMP_ORACLE_FAILED = 113;
const ERR_METADATA_STORE_FAILED = 114;

interface Assignment {
  hash: Buffer;
  studentId: string;
  courseId: number;
  timestamp: number;
  title: string;
  status: boolean;
}

interface AssignmentUpdate {
  updateTitle: string;
  updateHash: Buffer;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class AssignmentRegistryMock {
  state: {
    assignmentCounter: number;
    maxAssignmentsPerCourse: number;
    submissionFee: number;
    authorityContract: string | null;
    assignments: Map<number, Assignment>;
    assignmentsByHash: Map<string, number>;
    courseSubmissions: Map<number, number[]>;
    assignmentUpdates: Map<number, AssignmentUpdate>;
  } = {
    assignmentCounter: 0,
    maxAssignmentsPerCourse: 100,
    submissionFee: 50,
    authorityContract: null,
    assignments: new Map(),
    assignmentsByHash: new Map(),
    courseSubmissions: new Map(),
    assignmentUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      assignmentCounter: 0,
      maxAssignmentsPerCourse: 100,
      submissionFee: 50,
      authorityContract: null,
      assignments: new Map(),
      assignmentsByHash: new Map(),
      courseSubmissions: new Map(),
      assignmentUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (!this.isStandardPrincipal(contractPrincipal)) {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  private isStandardPrincipal(p: string): boolean {
    return p !== "SP000000000000000000002Q6VF78";
  }

  submitAssignment(
    hash: Buffer,
    title: string,
    courseId: number,
    studentId: string
  ): Result<number> {
    if (hash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (this.state.assignmentsByHash.has(hash.toString('hex'))) return { ok: false, value: ERR_DUPLICATE_ASSIGNMENT };
    const courseSubs = this.state.courseSubmissions.get(courseId) || [];
    if (courseSubs.length >= this.state.maxAssignmentsPerCourse) return { ok: false, value: ERR_MAX_ASSIGNMENTS_EXCEEDED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_UNAUTHORIZED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.assignmentCounter;
    const assignment: Assignment = {
      hash,
      studentId,
      courseId,
      timestamp: this.blockHeight,
      title,
      status: true,
    };
    this.state.assignments.set(id, assignment);
    this.state.assignmentsByHash.set(hash.toString('hex'), id);
    const newSubs = [...courseSubs, id];
    this.state.courseSubmissions.set(courseId, newSubs.slice(0, 100));
    this.state.assignmentCounter++;
    return { ok: true, value: id };
  }

  getAssignment(id: number): Assignment | null {
    return this.state.assignments.get(id) || null;
  }

  updateAssignment(id: number, newTitle: string, newHash: Buffer): Result<boolean> {
    const assignment = this.state.assignments.get(id);
    if (!assignment) return { ok: false, value: false };
    if (assignment.studentId !== this.caller) return { ok: false, value: false };
    if (newHash.length !== 32) return { ok: false, value: false };
    if (!newTitle || newTitle.length > 100) return { ok: false, value: false };
    if (this.state.assignmentsByHash.has(newHash.toString('hex')) && this.state.assignmentsByHash.get(newHash.toString('hex')) !== id) {
      return { ok: false, value: false };
    }

    const oldHashHex = assignment.hash.toString('hex');
    this.state.assignmentsByHash.delete(oldHashHex);
    this.state.assignmentsByHash.set(newHash.toString('hex'), id);

    const updated: Assignment = {
      ...assignment,
      hash: newHash,
      title: newTitle,
      timestamp: this.blockHeight,
    };
    this.state.assignments.set(id, updated);
    this.state.assignmentUpdates.set(id, {
      updateTitle: newTitle,
      updateHash: newHash,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  verifyAssignment(id: number, studentId: string): Result<boolean> {
    const assignment = this.state.assignments.get(id);
    if (!assignment) return { ok: false, value: false };
    return { ok: true, value: assignment.studentId === studentId && assignment.status };
  }

  listAssignments(courseId: number): Result<number[]> {
    return { ok: true, value: this.state.courseSubmissions.get(courseId) || [] };
  }

  getAssignmentCount(): Result<number> {
    return { ok: true, value: this.state.assignmentCounter };
  }

  checkAssignmentExistence(hash: Buffer): Result<boolean> {
    return { ok: true, value: this.state.assignmentsByHash.has(hash.toString('hex')) };
  }
}

describe("AssignmentRegistryMock", () => {
  let contract: AssignmentRegistryMock;

  beforeEach(() => {
    contract = new AssignmentRegistryMock();
    contract.reset();
  });

  it("submits an assignment successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    const result = contract.submitAssignment(hash, "Essay Title", 1, "ST1STUDENT");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const assignment = contract.getAssignment(0);
    expect(assignment?.title).toBe("Essay Title");
    expect(assignment?.hash.toString('hex')).toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    expect(assignment?.courseId).toBe(1);
    expect(assignment?.studentId).toBe("ST1STUDENT");
    expect(contract.stxTransfers).toEqual([{ amount: 50, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate assignment hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    contract.submitAssignment(hash, "First Essay", 1, "ST1STUDENT");
    const result = contract.submitAssignment(hash, "Duplicate Essay", 1, "ST1STUDENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_ASSIGNMENT);
  });

  it("rejects invalid hash length", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("short", 'hex');
    const result = contract.submitAssignment(hash, "Essay", 1, "ST1STUDENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects empty title", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    const result = contract.submitAssignment(hash, "", 1, "ST1STUDENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects update for non-existent assignment", () => {
    contract.setAuthorityContract("ST2TEST");
    const newHash = Buffer.from("newhash".repeat(8), 'hex');
    const result = contract.updateAssignment(99, "New Title", newHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-student", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    contract.submitAssignment(hash, "Title", 1, "ST1STUDENT");
    contract.caller = "ST2FAKE";
    const newHash = Buffer.from("newhash".repeat(8), 'hex');
    const result = contract.updateAssignment(0, "New Title", newHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("verifies assignment ownership correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    contract.submitAssignment(hash, "Title", 1, "ST1STUDENT");
    const result = contract.verifyAssignment(0, "ST1STUDENT");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const wrongResult = contract.verifyAssignment(0, "ST2FAKE");
    expect(wrongResult.ok).toBe(true);
    expect(wrongResult.value).toBe(false);
  });

  it("checks assignment existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    contract.submitAssignment(hash, "Title", 1, "ST1STUDENT");
    const result = contract.checkAssignmentExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const nonHash = Buffer.from("nonexistent", 'hex');
    const nonResult = contract.checkAssignmentExistence(nonHash);
    expect(nonResult.ok).toBe(true);
    expect(nonResult.value).toBe(false);
  });

  it("rejects submission without authority contract", () => {
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    const result = contract.submitAssignment(hash, "Title", 1, "ST1STUDENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(100);
    const hash = Buffer.from("deadbeef".repeat(8), 'hex');
    contract.submitAssignment(hash, "Title", 1, "ST1STUDENT");
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });
});