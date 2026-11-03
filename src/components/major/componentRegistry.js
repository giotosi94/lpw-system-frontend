import GenericStepData from './GenericStepData'
import ScrapBaseline from './routes/processScrapReduction/ScrapBaseline'
import BasicConditions from './routes/processScrapReduction/BasicConditions'
import TrainingPlan from './routes/processScrapReduction/TrainingPlan'
import AnomalyAnalysis from './routes/processScrapReduction/AnomalyAnalysis'
import EcrsAnalysis from './routes/processScrapReduction/EcrsAnalysis'
import SustainmentPlan from './routes/processScrapReduction/SustainmentPlan'

const COMPONENT_REGISTRY = {
  scrap_baseline: ScrapBaseline,
  basic_conditions: BasicConditions,
  scrap_event_register: TrainingPlan,
  training_plan: TrainingPlan,
  anomaly_analysis: AnomalyAnalysis,
  ecrs_analysis: EcrsAnalysis,
  sustainment_plan: SustainmentPlan,
}

export function getStepComponent(componente) {
  return COMPONENT_REGISTRY[componente] || GenericStepData
}
