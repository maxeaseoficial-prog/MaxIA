import { Brain } from './components/Brain'
import { Orb } from './components/Orb'

export function App() {
  const route = location.hash.replace('#', '') || '/orb'
  return route === '/brain' ? <Brain /> : <Orb />
}
