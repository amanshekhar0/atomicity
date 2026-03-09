import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AtomityIntelligenceEngine } from './components/AtomityIntelligenceEngine'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AtomityIntelligenceEngine />
    </QueryClientProvider>
  )
}

export default App
