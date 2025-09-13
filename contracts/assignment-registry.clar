(define-constant ERR-COURSE-NOT-FOUND (err u100))
(define-constant ERR-DUPLICATE-ASSIGNMENT (err u101))
(define-constant ERR-UNAUTHORIZED (err u102))
(define-constant ERR-INVALID-HASH (err u103))
(define-constant ERR-INVALID-TITLE (err u104))
(define-constant ERR-INVALID-STUDENT-ID (err u105))
(define-constant ERR-INVALID-COURSE-ID (err u106))
(define-constant ERR-ASSIGNMENT-NOT-FOUND (err u107))
(define-constant ERR-MAX-ASSIGNMENTS-EXCEEDED (err u109))

(define-data-var assignment-counter uint u0)
(define-data-var max-assignments-per-course uint u100)
(define-data-var submission-fee uint u50)
(define-data-var authority-contract (optional principal) none)

(define-map assignments
  { assignment-id: uint }
  { hash: (buff 32), student-id: principal, course-id: uint, timestamp: uint, title: (string-ascii 100), status: bool }
)

(define-map assignments-by-hash (buff 32) uint)
(define-map course-submissions uint (list 100 uint))

(define-read-only (get-assignment (id uint))
  (map-get? assignments { assignment-id: id })
)

(define-read-only (is-assignment-registered (h (buff 32)))
  (is-some (map-get? assignments-by-hash h))
)

(define-read-only (get-course-submissions (course-id uint))
  (default-to (list) (map-get? course-submissions course-id))
)

(define-read-only (get-assignment-count)
  (ok (var-get assignment-counter))
)

(define-private (validate-inputs (h (buff 32)) (t (string-ascii 100)) (s principal) (c uint))
  (begin
    (asserts! (is-eq (len h) u32) ERR-INVALID-HASH)
    (asserts! (and (> (len t) u0) (<= (len t) u100)) ERR-INVALID-TITLE)
    (asserts! (not (is-eq s 'SP000000000000000000002Q6VF78)) ERR-INVALID-STUDENT-ID)
    (asserts! (> c u0) ERR-INVALID-COURSE-ID)
    (ok true)
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (not (is-eq contract-principal 'SP000000000000000000002Q6VF78)) ERR-UNAUTHORIZED)
    (asserts! (is-none (var-get authority-contract)) ERR-UNAUTHORIZED)
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) ERR-UNAUTHORIZED)
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (submit-assignment (hash (buff 32)) (title (string-ascii 100)) (course-id uint) (student-id principal))
  (let
    (
      (id (var-get assignment-counter))
      (ts (block-height))
      (subs (get-course-submissions course-id))
      (authority (unwrap! (var-get authority-contract) ERR-UNAUTHORIZED))
    )
    (try! (validate-inputs hash title student-id course-id))
    (asserts! (< (len subs) (var-get max-assignments-per-course)) ERR-MAX-ASSIGNMENTS-EXCEEDED)
    (asserts! (is-none (map-get? assignments-by-hash hash)) ERR-DUPLICATE-ASSIGNMENT)
    (asserts! (is-some (unwrap! (contract-call? .course-manager verify-course course-id) ERR-COURSE-NOT-FOUND)) ERR-COURSE-NOT-FOUND)
    (try! (stx-transfer? (var-get submission-fee) tx-sender authority))
    (map-set assignments
      { assignment-id: id }
      { hash: hash, student-id: student-id, course-id: course-id, timestamp: ts, title: title, status: true }
    )
    (map-set assignments-by-hash hash id)
    (map-set course-submissions course-id (unwrap! (as-max-len? (append subs id) u100) (err u500)))
    (var-set assignment-counter (+ id u1))
    (try! (contract-call? .metadata-store store-metadata id title student-id))
    (try! (contract-call? .notification-system notify-submission course-id id))
    (try! (contract-call? .audit-log log-submission id student-id course-id ts))
    (print { event: "assignment-submitted", id: id })
    (ok id)
  )
)

(define-public (update-assignment (id uint) (new-title (string-ascii 100)) (new-hash (buff 32)))
  (let ((a (unwrap! (map-get? assignments { assignment-id: id }) ERR-ASSIGNMENT-NOT-FOUND)))
    (asserts! (is-eq (get student-id a) tx-sender) ERR-UNAUTHORIZED)
    (try! (validate-inputs new-hash new-title tx-sender (get course-id a)))
    (asserts! (or (is-eq new-hash (get hash a)) (is-none (map-get? assignments-by-hash new-hash))) ERR-DUPLICATE-ASSIGNMENT)
    (map-delete assignments-by-hash (get hash a))
    (map-set assignments-by-hash new-hash id)
    (map-set assignments
      { assignment-id: id }
      { hash: new-hash, student-id: (get student-id a), course-id: (get course-id a), timestamp: block-height, title: new-title, status: (get status a) }
    )
    (print { event: "assignment-updated", id: id })
    (ok true)
  )
)

(define-read-only (verify-assignment (id uint) (student-id principal))
  (match (map-get? assignments { assignment-id: id })
    a (ok (and (is-eq (get student-id a) student-id) (get status a)))
    (err ERR-ASSIGNMENT-NOT-FOUND)
  )
)