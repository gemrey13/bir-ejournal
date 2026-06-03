import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Testing from '@renderer/Testing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Testing />
  </StrictMode>
)
