import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockContract = {
  capacityPlans: new Map(),
  capacityForecasts: new Map(),
  scalingDecisions: new Map(),
  resourceMetrics: new Map(),
  totalPlans: 0,
  planningEnabled: true,
  defaultForecastPeriod: 30
}

let mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
let mockBlockHeight = 1000

// Helper functions
function createCapacityPlan(planId, resourceId, currentCapacity, plannedCapacity, targetUtilization) {
  if (currentCapacity <= 0 || plannedCapacity <= 0) {
    return { error: 'ERR_INVALID_CAPACITY' }
  }
  
  if (targetUtilization > 100) {
    return { error: 'ERR_INVALID_CAPACITY' }
  }
  
  if (mockContract.capacityPlans.has(planId)) {
    return { error: 'ERR_INVALID_CAPACITY' }
  }
  
  mockContract.capacityPlans.set(planId, {
    resourceId: resourceId,
    currentCapacity: currentCapacity,
    plannedCapacity: plannedCapacity,
    targetUtilization: targetUtilization,
    forecastPeriod: mockContract.defaultForecastPeriod,
    createdAt: mockBlockHeight,
    status: 'active',
    createdBy: mockTxSender
  })
  
  mockContract.totalPlans += 1
  return { success: true }
}

function generateForecast(resourceId, period) {
  if (!mockContract.resourceMetrics.has(resourceId)) {
    return { error: 'ERR_INVALID_FORECAST' }
  }
  
  const metrics = mockContract.resourceMetrics.get(resourceId)
  const predictedDemand = calculatePredictedDemand(metrics, period)
  const recommendedCapacity = calculateRecommendedCapacity(metrics, predictedDemand)
  const confidence = calculateConfidenceLevel(metrics)
  
  mockContract.capacityForecasts.set(`${resourceId}-${period}`, {
    predictedDemand: predictedDemand,
    recommendedCapacity: recommendedCapacity,
    confidenceLevel: confidence,
    forecastAccuracy: 0,
    createdAt: mockBlockHeight
  })
  
  return { success: true, recommendedCapacity: recommendedCapacity }
}

function makeScalingDecision(resourceId, decisionType, fromCapacity, toCapacity, reason) {
  if (fromCapacity <= 0 || toCapacity <= 0) {
    return { error: 'ERR_INVALID_CAPACITY' }
  }
  
  mockContract.scalingDecisions.set(`${resourceId}-${mockBlockHeight}`, {
    decisionType: decisionType,
    fromCapacity: fromCapacity,
    toCapacity: toCapacity,
    reason: reason,
    implemented: false,
    decisionMaker: mockTxSender
  })
  
  return { success: true }
}

function updateResourceMetrics(resourceId, avgUtilization, peakUtilization, minUtilization) {
  if (avgUtilization > 100 || peakUtilization > 100 || minUtilization > 100) {
    return { error: 'ERR_INVALID_CAPACITY' }
  }
  
  const trend = calculateTrend(avgUtilization, peakUtilization, minUtilization)
  
  mockContract.resourceMetrics.set(resourceId, {
    avgUtilization: avgUtilization,
    peakUtilization: peakUtilization,
    minUtilization: minUtilization,
    trendDirection: trend,
    lastCalculated: mockBlockHeight
  })
  
  return { success: true }
}

function calculatePredictedDemand(metrics, period) {
  const baseDemand = metrics.avgUtilization
  const trendMultiplier = metrics.trendDirection === 'up' ? 110 :
      metrics.trendDirection === 'down' ? 90 : 100
  return Math.floor((baseDemand * trendMultiplier) / 100)
}

function calculateRecommendedCapacity(metrics, predictedDemand) {
  const safetyMargin = 20 // 20% safety margin
  return predictedDemand + Math.floor((predictedDemand * safetyMargin) / 100)
}

function calculateConfidenceLevel(metrics) {
  const variance = metrics.peakUtilization - metrics.minUtilization
  if (variance < 20) return 90
  if (variance < 40) return 75
  if (variance < 60) return 60
  return 45
}

function calculateTrend(avgUtil, peakUtil, minUtil) {
  const upperThreshold = avgUtil + 10
  const lowerThreshold = avgUtil - 10
  
  if (peakUtil > upperThreshold) return 'up'
  if (minUtil < lowerThreshold) return 'down'
  return 'stable'
}

function getCapacityPlan(planId) {
  return mockContract.capacityPlans.get(planId) || null
}

function getCapacityForecast(resourceId, period) {
  return mockContract.capacityForecasts.get(`${resourceId}-${period}`) || null
}

function getScalingDecision(resourceId, timestamp) {
  return mockContract.scalingDecisions.get(`${resourceId}-${timestamp}`) || null
}

function getResourceMetrics(resourceId) {
  return mockContract.resourceMetrics.get(resourceId) || null
}

function calculateOptimalCapacity(resourceId, targetUtilization) {
  const metrics = mockContract.resourceMetrics.get(resourceId)
  if (!metrics) return null
  
  return Math.floor((metrics.peakUtilization * 100) / targetUtilization)
}

describe('Capacity Planning Contract', () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContract.capacityPlans.clear()
    mockContract.capacityForecasts.clear()
    mockContract.scalingDecisions.clear()
    mockContract.resourceMetrics.clear()
    mockContract.totalPlans = 0
    mockContract.planningEnabled = true
    mockBlockHeight = 1000
  })
  
  describe('Capacity Plan Creation', () => {
    it('should create a capacity plan with valid parameters', () => {
      const result = createCapacityPlan('plan-001', 'resource-001', 100, 150, 80)
      
      expect(result.success).toBe(true)
      expect(mockContract.totalPlans).toBe(1)
      
      const plan = getCapacityPlan('plan-001')
      expect(plan.resourceId).toBe('resource-001')
      expect(plan.currentCapacity).toBe(100)
      expect(plan.plannedCapacity).toBe(150)
      expect(plan.targetUtilization).toBe(80)
      expect(plan.status).toBe('active')
    })
    
    it('should reject plan with invalid capacity values', () => {
      const result = createCapacityPlan('plan-001', 'resource-001', 0, 150, 80)
      
      expect(result.error).toBe('ERR_INVALID_CAPACITY')
      expect(mockContract.totalPlans).toBe(0)
    })
    
    it('should reject plan with target utilization over 100%', () => {
      const result = createCapacityPlan('plan-001', 'resource-001', 100, 150, 150)
      
      expect(result.error).toBe('ERR_INVALID_CAPACITY')
      expect(mockContract.totalPlans).toBe(0)
    })
    
    it('should reject duplicate plan IDs', () => {
      createCapacityPlan('plan-001', 'resource-001', 100, 150, 80)
      const result = createCapacityPlan('plan-001', 'resource-002', 200, 250, 75)
      
      expect(result.error).toBe('ERR_INVALID_CAPACITY')
      expect(mockContract.totalPlans).toBe(1)
    })
  })
  
  describe('Resource Metrics Management', () => {
    it('should update resource metrics with valid values', () => {
      const result = updateResourceMetrics('resource-001', 70, 90, 50)
      
      expect(result.success).toBe(true)
      
      const metrics = getResourceMetrics('resource-001')
      expect(metrics.avgUtilization).toBe(70)
      expect(metrics.peakUtilization).toBe(90)
      expect(metrics.minUtilization).toBe(50)
      expect(metrics.trendDirection).toBe('up') // peak > avg + 10
    })
    
    it('should reject metrics with values over 100%', () => {
      const result = updateResourceMetrics('resource-001', 150, 90, 50)
      
      expect(result.error).toBe('ERR_INVALID_CAPACITY')
    })
    
    it('should calculate trend direction correctly', () => {
      updateResourceMetrics('resource-001', 70, 85, 55) // stable
      let metrics = getResourceMetrics('resource-001')
      expect(metrics.trendDirection).toBe('up')
      
      updateResourceMetrics('resource-002', 70, 75, 45) // down trend
      metrics = getResourceMetrics('resource-002')
      expect(metrics.trendDirection).toBe('down')
      
      updateResourceMetrics('resource-003', 70, 75, 65) // stable
      metrics = getResourceMetrics('resource-003')
      expect(metrics.trendDirection).toBe('stable')
    })
  })
  
  describe('Capacity Forecasting', () => {
    beforeEach(() => {
      updateResourceMetrics('resource-001', 70, 90, 50)
    })
    
    it('should generate forecast with existing metrics', () => {
      const result = generateForecast('resource-001', 30)
      
      expect(result.success).toBe(true)
      expect(result.recommendedCapacity).toBeGreaterThan(0)
      
      const forecast = getCapacityForecast('resource-001', 30)
      expect(forecast).not.toBeNull()
      expect(forecast.predictedDemand).toBeGreaterThan(0)
      expect(forecast.confidenceLevel).toBeGreaterThan(0)
    })
    
    it('should reject forecast for resource without metrics', () => {
      const result = generateForecast('non-existent', 30)
      
      expect(result.error).toBe('ERR_INVALID_FORECAST')
    })
    
    it('should calculate confidence level based on variance', () => {
      // Low variance should result in high confidence
      updateResourceMetrics('resource-low-var', 70, 75, 65)
      generateForecast('resource-low-var', 30)
      
      const forecast = getCapacityForecast('resource-low-var', 30)
      expect(forecast.confidenceLevel).toBeGreaterThanOrEqual(75)
    })
  })
  
  describe('Scaling Decisions', () => {
    it('should record scaling decision with valid parameters', () => {
      const result = makeScalingDecision('resource-001', 'scale-up', 100, 150, 'Increased demand')
      
      expect(result.success).toBe(true)
      
      const decision = getScalingDecision('resource-001', mockBlockHeight)
      expect(decision.decisionType).toBe('scale-up')
      expect(decision.fromCapacity).toBe(100)
      expect(decision.toCapacity).toBe(150)
      expect(decision.reason).toBe('Increased demand')
      expect(decision.implemented).toBe(false)
    })
    
    it('should reject scaling decision with invalid capacity', () => {
      const result = makeScalingDecision('resource-001', 'scale-up', 0, 150, 'Invalid')
      
      expect(result.error).toBe('ERR_INVALID_CAPACITY')
    })
  })
  
  describe('Optimal Capacity Calculation', () => {
    beforeEach(() => {
      updateResourceMetrics('resource-001', 70, 90, 50)
    })
    
    it('should calculate optimal capacity based on peak utilization', () => {
      const optimalCapacity = calculateOptimalCapacity('resource-001', 80)
      
      expect(optimalCapacity).toBe(112) // (90 * 100) / 80 = 112.5, floored to 112
    })
    
    it('should return null for non-existent resource', () => {
      const optimalCapacity = calculateOptimalCapacity('non-existent', 80)
      
      expect(optimalCapacity).toBeNull()
    })
  })
  
  describe('Data Retrieval', () => {
    it('should retrieve capacity plan by ID', () => {
      createCapacityPlan('plan-001', 'resource-001', 100, 150, 80)
      
      const plan = getCapacityPlan('plan-001')
      expect(plan).not.toBeNull()
      expect(plan.resourceId).toBe('resource-001')
    })
    
    it('should return null for non-existent plan', () => {
      const plan = getCapacityPlan('non-existent')
      expect(plan).toBeNull()
    })
  })
})
