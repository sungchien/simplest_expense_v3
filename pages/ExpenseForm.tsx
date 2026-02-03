
import React, { useState, useRef, useEffect } from 'react';
import { Expense, ExpenseItem } from '../types';
import { ItemLabels, ItemIcons } from './Dashboard';
import { GoogleGenAI, Type } from "@google/genai";

interface ExpenseFormProps {
  initialExpense?: Expense;
  onSave: (amount: number, item: ExpenseItem, description: string) => void;
  onCancel: () => void;
  title: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialExpense, onSave, onCancel, title }) => {
  const [amount, setAmount] = useState<string>(initialExpense?.amount.toString() || '');
  const [item, setItem] = useState<ExpenseItem>(initialExpense?.item || ExpenseItem.FOOD);
  const [description, setDescription] = useState<string>(initialExpense?.description || '');
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableItems = Object.values(ExpenseItem);

  // 初始檢查是否已有金鑰
  useEffect(() => {
    const checkKey = async () => {
      try {
        // @ts-ignore
        const selected = await window.aistudio?.hasSelectedApiKey();
        setHasKey(selected ?? false);
      } catch (e) {
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0 && description) {
      onSave(numAmount, item, description);
    } else {
      alert('請填寫完整正確的資訊');
    }
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeySetup = async () => {
    try {
      // @ts-ignore
      await window.aistudio?.openSelectKey();
      setHasKey(true);
    } catch (e) {
      console.error("Key setup cancelled", e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setCapturedImage(reader.result as string);
    } catch (error) {
      console.error("[AI] 圖片讀取失敗:", error);
    }
  };

  const performAiRecognition = async () => {
    if (!capturedImage) return;

    // 檢查金鑰，若無則引導授權
    // @ts-ignore
    const isKeySelected = await window.aistudio?.hasSelectedApiKey();
    if (!isKeySelected || !process.env.API_KEY) {
      await handleKeySetup();
    }

    setIsScanning(true);
    
    try {
      const currentApiKey = process.env.API_KEY;
      if (!currentApiKey) throw new Error("請先授權 API Key");

      const base64Content = capturedImage.split(',')[1];
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Content, mimeType: "image/jpeg" } },
            { text: `辨識收據內容並回傳 JSON: {amount: number, description: string, item: string(food, transport, housing, shopping, entertainment, clothing, health, other)}` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              item: { type: Type.STRING }
            },
            required: ["amount", "description", "item"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.amount) setAmount(result.amount.toString());
      if (result.description) setDescription(result.description);
      if (result.item && availableItems.includes(result.item as ExpenseItem)) {
        setItem(result.item as ExpenseItem);
      }
      setCapturedImage(null); // 辨識成功後清除預覽
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("金鑰無效或專案未授權計費。請重新設置金鑰。");
      } else {
        alert(`辨識失敗: ${error.message}`);
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-300">
      {/* 掃描動畫 */}
      {isScanning && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-10 text-center">
          <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
          <h3 className="text-white text-2xl font-black italic">Gemini 辨識中...</h3>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-8 px-6 relative">
        <button 
          onClick={handleScanClick}
          className="absolute top-6 right-6 bg-white size-12 rounded-2xl shadow-xl border border-blue-50 text-primary flex items-center justify-center active:scale-90 z-10"
        >
          <span className="material-symbols-outlined text-2xl font-bold">photo_camera</span>
        </button>

        <p className="text-primary font-bold tracking-[0.2em] mb-2 text-[10px] uppercase opacity-40">消費金額 (NT$)</p>
        <div className="flex items-center justify-center w-full">
          <span className="text-text-main tracking-tighter text-6xl font-extrabold mr-1">$</span>
          <input 
            autoFocus
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent border-none p-0 text-text-main tracking-tighter text-6xl font-extrabold w-48 text-left focus:ring-0 placeholder:text-blue-100" 
            placeholder="0" 
          />
        </div>
      </div>

      <div className="bg-white rounded-t-[40px] flex-1 p-8 border-t border-blue-50 shadow-inner overflow-y-auto">
        {/* AI 辨識設定卡片 */}
        <div className="mb-8 p-5 bg-primary-light rounded-[28px] border border-primary-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
              <h4 className="text-sm font-bold">AI 智慧辨識</h4>
            </div>
            <div className={`size-2 rounded-full ${hasKey ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`}></div>
          </div>
          
          {capturedImage ? (
            <div className="flex flex-col gap-4">
              <img src={capturedImage} className="w-full h-32 object-cover rounded-2xl border-2 border-white shadow-sm" alt="Preview" />
              <button 
                onClick={performAiRecognition}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                立即分析圖片
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-primary/60 font-medium">
                {hasKey ? '金鑰已就緒，可點擊上方相機進行收據辨識。' : '尚未授權 Gemini API，請點擊下方按鈕進行設定。'}
              </p>
              <button 
                onClick={handleKeySetup}
                className="text-xs font-black text-primary bg-white px-4 py-2 rounded-lg border border-primary-soft shadow-sm hover:bg-primary hover:text-white transition-all self-start"
              >
                {hasKey ? '更改 API 金鑰' : '立即設置 API Key'}
              </button>
            </div>
          )}
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="text-[9px] text-primary/40 underline block mt-3"
          >
            關於金鑰計費與授權說明
          </a>
        </div>

        <div className="mb-8">
          <h3 className="text-text-main text-sm font-bold tracking-tight mb-5">支出類別</h3>
          <div className="grid grid-cols-4 gap-3">
            {availableItems.map(itemKey => (
              <button
                key={itemKey}
                onClick={() => setItem(itemKey as ExpenseItem)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                  item === itemKey 
                    ? 'bg-primary border-primary text-white shadow-lg scale-105 z-10' 
                    : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{ItemIcons[itemKey as ExpenseItem]}</span>
                <span className="text-[10px] font-bold truncate w-full text-center">{ItemLabels[itemKey as ExpenseItem]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-text-main text-sm font-bold tracking-tight mb-3">消費說明</h3>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-text-main placeholder:text-slate-300 focus:ring-4 focus:ring-primary/5 focus:border-primary h-24 resize-none transition-all outline-none text-sm" 
            placeholder="記錄一下這筆錢花在哪裡..."
          />
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />

      {/* 底部按鈕區 */}
      <div className="sticky bottom-0 w-full bg-white border-t border-blue-50 pb-8 px-8 pt-6 flex gap-3">
        <button 
          onClick={onCancel}
          className="flex-[1] bg-slate-50 text-slate-400 font-bold py-5 rounded-[24px] border border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
        >
          取消
        </button>
        <button 
          onClick={handleSave}
          className="flex-[2.5] bg-primary hover:bg-primary-dark text-white font-bold py-5 rounded-[24px] shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 text-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined font-bold text-2xl">check_circle</span>
          確認儲存
        </button>
      </div>
    </div>
  );
};

export default ExpenseForm;
