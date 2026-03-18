import React, { useEffect } from "react";

export default function DemoModeToggle({ isDemoMode, setIsDemoMode }) {
  const toggle = () => {
    const newVal = !isDemoMode;
    setIsDemoMode(newVal);
    localStorage.setItem("blockcert_demo_mode", newVal ? "true" : "false");
    
    // Simple toast
    const msg = newVal 
      ? "Switched to Demo Mode — using local Hardhat" 
      : "Switched to Live Mode — Polygon Amoy";
      
    // Quick native element toast to avoid adding toast libraries
    const toast = document.createElement("div");
    toast.className = "fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 text-sm border border-gray-700 animate-slide-up";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("opacity-0");
      toast.classList.add("transition-opacity");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };

  return (
    <button 
      onClick={toggle}
      className={`fixed top-3 left-3 z-[9999] px-3 py-1.5 rounded-lg border shadow-lg flex flex-col items-start transition-all ${
        isDemoMode 
          ? "bg-orange-600 hover:bg-orange-500 border-orange-400/50" 
          : "bg-gray-900 hover:bg-gray-800 border-blue-500/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isDemoMode ? "bg-white animate-pulse" : "bg-green-400"}`}></span> 
          {isDemoMode ? "DEMO MODE" : "LIVE MODE"}
        </span>
      </div>
      <span className={`text-[10px] uppercase font-medium mt-0.5 ${isDemoMode ? "text-orange-200" : "text-blue-400"}`}>
        {isDemoMode ? "Hardhat Local" : "Polygon Amoy"}
      </span>
    </button>
  );
}
