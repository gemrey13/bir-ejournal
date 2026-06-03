import React, { useState, useEffect, useRef } from 'react'
import { Calendar, FolderOpen, ShieldCheck, Binary, ArrowRight } from 'lucide-react'

interface AuditFormData {
  fromMonth: string
  toMonth: string
  branchPath: string
  branchCode: string
  branchSales: number | ''
  birSales: number | ''
  maxLowValue: number | ''
  minHighValue: number | ''
}

export default function App() {
  const [formData, setFormData] = useState<AuditFormData>({
    fromMonth: '2022-01',
    toMonth: '2022-01',
    branchPath: '',
    branchCode: '',
    branchSales: '',
    birSales: 209159.55,
    maxLowValue: 500.0,
    minHighValue: 1000.0
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on primary input field for immediate keyboard entry
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  // Live parsing engine for immediate branch token reflection
  useEffect(() => {
    if (formData.branchPath) {
      const normalized = formData.branchPath.replace(/\\/g, '/')
      const lastSegment = normalized.split('/').filter(Boolean).pop() || ''
      setFormData((prev) => ({ ...prev, branchCode: lastSegment.toUpperCase() }))
    }
  }, [formData.branchPath])

  const handleFolderBrowse = async () => {
    // FIXED: Adjusted to window.electronAPI to match your IPC bridge setup exactly
    if (window.api?.selectDirectory) {
      const selectedPath = await window.api.selectDirectory()
      if (selectedPath) {
        setFormData((prev) => ({ ...prev, branchPath: selectedPath }))
      }
    } else {
      // Local development terminal layout fallback
      setFormData((prev) => ({
        ...prev,
        branchPath: 'C:\\Users\\Gem\\Desktop\\Giligans\\ARA'
      }))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }))
  }

  const executeAuditGeneration = (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      alert(`Data Packets Successfully Compiled for Branch [${formData.branchCode}]`)
    }, 1800)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans tracking-tight antialiased selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Minimalist Light Header */}
      <header className="max-w-6xl w-full mx-auto px-8 pt-8 pb-4 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white border border-slate-200 rounded-lg text-emerald-600 shadow-xs">
            <Binary size={18} className="stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              BIR eJournal & Auditing
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              Engine v2.0.0
            </p>
          </div>
        </div>
        
        <div className="text-[10px] font-mono font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md flex items-center space-x-1.5 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Ready</span>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-6 flex flex-col justify-center">
        <form onSubmit={executeAuditGeneration} className="space-y-10">
          
          {/* Main Grid Content Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-8">
            
            {/* Left Content Context: Configurations */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Row 1: Reporting Durations */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium tracking-wide">
                  <Calendar size={13} className="text-slate-400" />
                  <span>Processing Period Matrix</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Date From</label>
                    <input
                      ref={firstInputRef}
                      type="month"
                      name="fromMonth"
                      required
                      value={formData.fromMonth}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 transition-all font-mono shadow-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Date To</label>
                    <input
                      type="month"
                      name="toMonth"
                      required
                      min={formData.fromMonth}
                      value={formData.toMonth}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 transition-all font-mono shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Folder Allocation & Target Code Map */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium tracking-wide">
                  <FolderOpen size={13} className="text-slate-400" />
                  <span>Workspace Directory Ingestion</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Target Folder Filepath</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        readOnly
                        required
                        placeholder="C:\Users\...\Giligans\Branch"
                        value={formData.branchPath}
                        className="flex-1 bg-slate-100/60 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-500 focus:outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleFolderBrowse}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-xs tracking-wide transition-colors active:bg-slate-100 shadow-xs"
                      >
                        Browse Folder
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Identified Branch Code</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="N/A"
                        value={formData.branchCode}
                        className="w-full bg-slate-100/40 border border-transparent rounded-lg px-3.5 py-2 text-sm text-emerald-600 font-bold tracking-widest font-mono focus:outline-none select-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Branch Financial Sales</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-mono text-xs">₱</span>
                        <input
                          type="number"
                          name="branchSales"
                          required
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.branchSales}
                          onChange={handleInputChange}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3.5 py-2 text-sm text-slate-800 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side Column Set: Control Parameters */}
            <div className="bg-slate-100/40 border border-slate-200/60 rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase border-b border-slate-200 pb-2">
                  Validation Thresholds
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">BIR Reference Sales</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none text-slate-300 font-mono text-xs">₱</span>
                    <input
                      type="number"
                      name="birSales"
                      required
                      step="0.01"
                      value={formData.birSales}
                      onChange={handleInputChange}
                      className="w-full bg-transparent border-b border-slate-200 focus:border-emerald-500 pl-4 pr-1 py-1 text-sm text-emerald-600 font-semibold font-mono focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Maximum Low-Value Limit</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none text-slate-300 font-mono text-xs">₱</span>
                    <input
                      type="number"
                      name="maxLowValue"
                      required
                      step="0.01"
                      value={formData.maxLowValue}
                      onChange={handleInputChange}
                      className="w-full bg-transparent border-b border-slate-200 focus:border-emerald-500 pl-4 pr-1 py-1 text-sm text-slate-700 font-mono focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Minimum High-Value Limit</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none text-slate-300 font-mono text-xs">₱</span>
                    <input
                      type="number"
                      name="minHighValue"
                      required
                      step="0.01"
                      value={formData.minHighValue}
                      onChange={handleInputChange}
                      className="w-full bg-transparent border-b border-slate-200 focus:border-emerald-500 pl-4 pr-1 py-1 text-sm text-slate-700 font-mono focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Execution Component */}
              <button
                type="submit"
                disabled={isProcessing}
                className={`w-full py-2.5 px-4 rounded-xl text-xs tracking-wider uppercase font-semibold transition-all flex items-center justify-center space-x-2 ${
                  isProcessing
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 text-white font-bold hover:bg-emerald-500 active:scale-[0.985] shadow-md shadow-emerald-600/10'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    <span>Compiling Logs...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} className="stroke-2" />
                    <span>Compile Audit</span>
                    <ArrowRight size={12} className="opacity-70" />
                  </>
                )}
              </button>

            </div>
          </div>
        </form>
      </main>
    </div>
  )
}