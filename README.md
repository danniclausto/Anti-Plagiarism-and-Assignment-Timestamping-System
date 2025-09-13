# Anti-Plagiarism and Assignment Timestamping System

This project uses the Stacks blockchain and Clarity smart contracts to create a decentralized system for timestamping academic assignments and detecting plagiarism. It ensures academic integrity by providing immutable proof of submission time and originality.

## ✨ Features

- 📝 **Timestamp Assignments**: Students submit assignment hashes to timestamp their work.
- 🔍 **Plagiarism Detection**: Compare hashes to identify duplicate or similar submissions.
- ✅ **Ownership Verification**: Confirm the student and timestamp of a submission.
- 📅 **Immutable Submission Records**: Ensure timestamps are tamper-proof.
- 🚫 **Prevent Duplicate Submissions**: Block identical assignments in the same course.
- 🔒 **Private Metadata Storage**: Securely store assignment metadata with access control.
- 🔔 **Submission Notifications**: Notify educators of new submissions.
- 📊 **Audit Trail**: Maintain a transparent record of all submissions.

## 🛠 How It Works

**For Students**:
- Generate a SHA-256 hash of your assignment file.
- Call `submit-assignment` with the hash, title, and student ID.
- Receive a unique assignment ID and confirmation of submission.

**For Educators**:
- Use `verify-assignment` to confirm submission details and originality.
- Use `check-plagiarism` to compare an assignment against others in the course.
- Access metadata via `get-assignment-details` for grading.
- View course submissions with `list-assignments`.

**For Administrators**:
- Create courses with `create-course` and assign moderators with `set-course-moderator`.
- Audit submissions using `get-submission-audit-trail`.

## 📚 Smart Contracts

1. **AssignmentRegistry**: Registers and timestamps assignments.
2. **PlagiarismChecker**: Detects duplicate or similar submissions.
3. **OwnershipVerifier**: Verifies student ownership of submissions.
4. **CourseManager**: Manages courses and moderator roles.
5. **MetadataStore**: Stores assignment metadata with access control.
6. **TimestampOracle**: Provides immutable timestamps.
7. **NotificationSystem**: Notifies educators of submissions.
8. **AuditLog**: Logs all actions for auditing.

## 🚀 Getting Started

1. Deploy the smart contracts on the Stacks blockchain.
2. Students generate a SHA-256 hash of their assignment file.
3. Call `submit-assignment` with the hash, title, and course ID.
4. Educators verify submissions using `verify-assignment` and check for plagiarism with `check-plagiarism`.
5. Administrators create courses and assign moderators using `CourseManager`.

## 📖 Future Enhancements

- Integrate AI-based similarity detection for more advanced plagiarism checks.
- Add support for group assignments with multiple student IDs.
- Enable submission versioning for iterative assignments.
