;; Capacity Planning Contract
;; Manages resource capacity planning and allocation strategies

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_INVALID_CAPACITY (err u301))
(define-constant ERR_PLAN_NOT_FOUND (err u302))
(define-constant ERR_INVALID_FORECAST (err u303))

;; Data Variables
(define-data-var total-plans uint u0)
(define-data-var planning-enabled bool true)
(define-data-var default-forecast-period uint u30) ;; 30 blocks default

;; Data Maps
(define-map capacity-plans
  {plan-id: (string-ascii 64)}
  {
    resource-id: (string-ascii 64),
    current-capacity: uint,
    planned-capacity: uint,
    target-utilization: uint,
    forecast-period: uint,
    created-at: uint,
    status: (string-ascii 32),
    created-by: principal
  }
)

(define-map capacity-forecasts
  {resource-id: (string-ascii 64), period: uint}
  {
    predicted-demand: uint,
    recommended-capacity: uint,
    confidence-level: uint,
    forecast-accuracy: uint,
    created-at: uint
  }
)

(define-map scaling-decisions
  {resource-id: (string-ascii 64), timestamp: uint}
  {
    decision-type: (string-ascii 32), ;; "scale-up", "scale-down", "maintain"
    from-capacity: uint,
    to-capacity: uint,
    reason: (string-ascii 256),
    implemented: bool,
    decision-maker: principal
  }
)

(define-map resource-metrics
  {resource-id: (string-ascii 64)}
  {
    avg-utilization: uint,
    peak-utilization: uint,
    min-utilization: uint,
    trend-direction: (string-ascii 16), ;; "up", "down", "stable"
    last-calculated: uint
  }
)

;; Public Functions

;; Create capacity plan
(define-public (create-capacity-plan
  (plan-id (string-ascii 64))
  (resource-id (string-ascii 64))
  (current-capacity uint)
  (planned-capacity uint)
  (target-utilization uint))
  (begin
    (asserts! (> current-capacity u0) ERR_INVALID_CAPACITY)
    (asserts! (> planned-capacity u0) ERR_INVALID_CAPACITY)
    (asserts! (<= target-utilization u100) ERR_INVALID_CAPACITY)
    (asserts! (is-none (map-get? capacity-plans {plan-id: plan-id})) ERR_INVALID_CAPACITY)

    (map-set capacity-plans {plan-id: plan-id} {
      resource-id: resource-id,
      current-capacity: current-capacity,
      planned-capacity: planned-capacity,
      target-utilization: target-utilization,
      forecast-period: (var-get default-forecast-period),
      created-at: block-height,
      status: "active",
      created-by: tx-sender
    })

    (var-set total-plans (+ (var-get total-plans) u1))
    (print {event: "capacity-plan-created", plan-id: plan-id, resource-id: resource-id})
    (ok true)
  )
)

;; Generate capacity forecast
(define-public (generate-forecast (resource-id (string-ascii 64)) (period uint))
  (let ((metrics (unwrap! (map-get? resource-metrics {resource-id: resource-id}) ERR_INVALID_FORECAST)))
    (let ((predicted-demand (calculate-predicted-demand metrics period))
          (recommended-capacity (calculate-recommended-capacity metrics predicted-demand))
          (confidence (calculate-confidence-level metrics)))

      (map-set capacity-forecasts {resource-id: resource-id, period: period} {
        predicted-demand: predicted-demand,
        recommended-capacity: recommended-capacity,
        confidence-level: confidence,
        forecast-accuracy: u0, ;; Will be updated later
        created-at: block-height
      })

      (print {event: "forecast-generated", resource-id: resource-id, period: period})
      (ok recommended-capacity)
    )
  )
)

;; Make scaling decision
(define-public (make-scaling-decision
  (resource-id (string-ascii 64))
  (decision-type (string-ascii 32))
  (from-capacity uint)
  (to-capacity uint)
  (reason (string-ascii 256)))
  (begin
    (asserts! (> from-capacity u0) ERR_INVALID_CAPACITY)
    (asserts! (> to-capacity u0) ERR_INVALID_CAPACITY)

    (map-set scaling-decisions {resource-id: resource-id, timestamp: block-height} {
      decision-type: decision-type,
      from-capacity: from-capacity,
      to-capacity: to-capacity,
      reason: reason,
      implemented: false,
      decision-maker: tx-sender
    })

    (print {event: "scaling-decision-made", resource-id: resource-id, type: decision-type})
    (ok true)
  )
)

;; Update resource metrics
(define-public (update-resource-metrics
  (resource-id (string-ascii 64))
  (avg-utilization uint)
  (peak-utilization uint)
  (min-utilization uint))
  (begin
    (asserts! (<= avg-utilization u100) ERR_INVALID_CAPACITY)
    (asserts! (<= peak-utilization u100) ERR_INVALID_CAPACITY)
    (asserts! (<= min-utilization u100) ERR_INVALID_CAPACITY)

    (let ((trend (calculate-trend avg-utilization peak-utilization min-utilization)))
      (map-set resource-metrics {resource-id: resource-id} {
        avg-utilization: avg-utilization,
        peak-utilization: peak-utilization,
        min-utilization: min-utilization,
        trend-direction: trend,
        last-calculated: block-height
      })
    )

    (print {event: "metrics-updated", resource-id: resource-id})
    (ok true)
  )
)

;; Read-only Functions

;; Get capacity plan
(define-read-only (get-capacity-plan (plan-id (string-ascii 64)))
  (map-get? capacity-plans {plan-id: plan-id})
)

;; Get capacity forecast
(define-read-only (get-capacity-forecast (resource-id (string-ascii 64)) (period uint))
  (map-get? capacity-forecasts {resource-id: resource-id, period: period})
)

;; Get scaling decision
(define-read-only (get-scaling-decision (resource-id (string-ascii 64)) (timestamp uint))
  (map-get? scaling-decisions {resource-id: resource-id, timestamp: timestamp})
)

;; Get resource metrics
(define-read-only (get-resource-metrics (resource-id (string-ascii 64)))
  (map-get? resource-metrics {resource-id: resource-id})
)

;; Calculate optimal capacity
(define-read-only (calculate-optimal-capacity (resource-id (string-ascii 64)) (target-utilization uint))
  (match (map-get? resource-metrics {resource-id: resource-id})
    metrics
      (let ((avg-util (get avg-utilization metrics))
            (peak-util (get peak-utilization metrics)))
        (some (/ (* peak-util u100) target-utilization))
      )
    none
  )
)

;; Get total plans
(define-read-only (get-total-plans)
  (var-get total-plans)
)

;; Private Functions

;; Calculate predicted demand
(define-private (calculate-predicted-demand (metrics (tuple (avg-utilization uint) (peak-utilization uint) (min-utilization uint) (trend-direction (string-ascii 16)) (last-calculated uint))) (period uint))
  (let ((base-demand (get avg-utilization metrics))
        (trend-multiplier (if (is-eq (get trend-direction metrics) "up") u110
                            (if (is-eq (get trend-direction metrics) "down") u90 u100))))
    (/ (* base-demand trend-multiplier) u100)
  )
)

;; Calculate recommended capacity
(define-private (calculate-recommended-capacity (metrics (tuple (avg-utilization uint) (peak-utilization uint) (min-utilization uint) (trend-direction (string-ascii 16)) (last-calculated uint))) (predicted-demand uint))
  (let ((safety-margin u20)) ;; 20% safety margin
    (+ predicted-demand (/ (* predicted-demand safety-margin) u100))
  )
)

;; Calculate confidence level
(define-private (calculate-confidence-level (metrics (tuple (avg-utilization uint) (peak-utilization uint) (min-utilization uint) (trend-direction (string-ascii 16)) (last-calculated uint))))
  (let ((variance (- (get peak-utilization metrics) (get min-utilization metrics))))
    (if (< variance u20) u90
      (if (< variance u40) u75
        (if (< variance u60) u60 u45)
      )
    )
  )
)

;; Calculate trend direction
(define-private (calculate-trend (avg-util uint) (peak-util uint) (min-util uint))
  (let ((upper-threshold (+ avg-util u10))
        (lower-threshold (- avg-util u10)))
    (if (> peak-util upper-threshold) "up"
      (if (< min-util lower-threshold) "down" "stable")
    )
  )
)

;; Admin Functions

;; Update plan status
(define-public (update-plan-status (plan-id (string-ascii 64)) (new-status (string-ascii 32)))
  (let ((plan-data (unwrap! (map-get? capacity-plans {plan-id: plan-id}) ERR_PLAN_NOT_FOUND)))
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    (map-set capacity-plans {plan-id: plan-id}
      (merge plan-data {status: new-status}))

    (print {event: "plan-status-updated", plan-id: plan-id, status: new-status})
    (ok true)
  )
)

;; Set default forecast period
(define-public (set-default-forecast-period (period uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set default-forecast-period period)
    (print {event: "forecast-period-updated", period: period})
    (ok true)
  )
)
