
import React, { useState, useRef, useEffect } from 'react';
import { Expense, ExpenseItem } from '../types';
import { ItemLabels, ItemIcons } from './Dashboard';
import { GoogleGenAI, Type } from "@google/genai";

interface ExpenseFormProps {
  initialExpense?: Expense;
  onSave: (amount: number, item: ExpenseItem, description: string) => void;
  title: string;
}

// Fixed: Removed local declare global for window.aistudio to avoid conflict with the environment's AIStudio type.

const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialExpense, onSave, title }) => {
  const [amount, setAmount] = useState<string>(initialExpense?.amount.toString() || '');
  const [item, setItem] = useState<ExpenseItem>(initialExpense?.item || ExpenseItem.FOOD);
  const [description, setDescription] = useState<string>(initialExpense?.description || '');
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableItems = Object.values(ExpenseItem);

  // 檢查初始金鑰狀態
  useEffect(() => {
    const checkKey = async () => {
      try {
        // @ts-ignore - aistudio is provided by the environment
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Data = await fileToBase64(file);
      setCapturedImage(base64Data);
    } catch (error) {
      console.error("[AI] 圖片讀取失敗:", error);
    }
  };

  const performAiRecognition = async () => {
    if (!capturedImage) return;

    // 1. 確保 API Key 已選取
    // @ts-ignore - aistudio is provided by the environment
    const isKeySelected = await window.aistudio?.hasSelectedApiKey();
    if (!isKeySelected || !process.env.API_KEY) {
      console.log("[AI] 偵測到金鑰未授權，開啟授權視窗...");
      try {
        // @ts-ignore - aistudio is provided by the environment
        await window.aistudio?.openSelectKey();
        // 根據規範：假設選取成功，直接繼續後續流程，不在此中斷
        setHasKey(true);
      } catch (e) {
        console.error("[AI] 授權流程被取消", e);
        return;
      }
    }

    setIsScanning(true);
    
    try {
      // 2. 獲取最新注入的 API Key 並建立實例
      const currentApiKey = process.env.API_KEY;
      if (!currentApiKey) {
        throw new Error("未能獲取 API Key。請確保您已選取正確的 Google Cloud 專案金鑰。");
      }

      const base64Content = capturedImage.split(',')[1];
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Content,
                mimeType: "image/jpeg",
              },
            },
            {
              text: `你是一位收據識別助手。請分析圖片內容並識別：
              1. amount (number): 消費總額
              2. description (string): 消費店家或內容
              3. item (string): 類別，必須是 food, transport, housing, shopping, entertainment, clothing, health, other 其中之一。
              回傳格式必須為 JSON。`
            }
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

    } catch (error: any) {
      console.error("[AI] 辨識錯誤:", error);
      
      // 根據規範：若發生 404/entity not found 錯誤，重設金鑰狀態並引導重新選取
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key not valid")) {
        setHasKey(false);
        alert("目前的金鑰或專案無效。請點擊按鈕重新「管理金鑰」，並確保選取的是具備付費專案的 API Key。");
      } else {
        alert(`辨識失敗: ${error.message}`);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-300">
      {/* 掃描動畫特效 */}
      {isScanning && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-10 text-center">
          <div className="relative mb-12">
            <div className="w-32 h-32 border-8 border-white/20 border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-6xl animate-pulse">qr_code_scanner</span>
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-white shadow-[0_0_20px_white] animate-[bounce_1.5s_infinite]"></div>
          </div>
          <h3 className="text-white text-3xl font-black italic tracking-tight mb-3">智慧分析中</h3>
          <p className="text-white/80 text-sm font-medium">Gemini 正在提取收據資訊...</p>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-8 px-6 relative">
        {!initialExpense && (
          <button 
            onClick={handleScanClick}
            className="absolute top-6 right-6 bg-white size-12 rounded-2xl shadow-xl border border-blue-50 text-primary flex items-center justify-center active:scale-90 transition-all z-10"
          >
            <span className="material-symbols-outlined text-2xl font-bold">photo_camera</span>
          </button>
        )}

        {capturedImage && !initialExpense && (
          <div className="w-full flex flex-col items-center mb-8 animate-in zoom-in-90 duration-500">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-tr from-primary/20 to-blue-400/20 blur-xl rounded-full opacity-50"></div>
              <img 
                src={capturedImage} 
                alt="Receipt" 
                className="relative w-40 h-40 object-cover rounded-[32px] border-4 border-white shadow-2xl rotate-2"
              />
              <button 
                onClick={() => setCapturedImage(null)}
                className="absolute -top-3 -right-3 bg-red-500 text-white size-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>
            
            <button 
              onClick={performAiRecognition}
              className={`mt-8 px-10 py-4 rounded-full font-black italic tracking-widest shadow-xl transition-all flex items-center gap-3 active:scale-95 ${
                hasKey 
                  ? 'bg-primary text-white shadow-primary/30' 
                  : 'bg-orange-500 text-white shadow-orange-200'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {hasKey ? 'auto_awesome' : 'vpn_key'}
              </span>
              {hasKey ? '開始智慧辨識' : '點擊以授權 API Key'}
            </button>
            
            <p className="mt-4 text-[10px] text-slate-400 text-center px-10">
              {hasKey ? 'AI 功能已就緒。' : '辨識功能需選取具備付費專案的 API Key。'}
              <br/>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                className="text-primary underline font-bold"
              >
                瞭解計費與授權規範
              </a>
            </p>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
        />

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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-text-main text-sm font-bold tracking-tight">支出類別</h3>
            <span className="text-primary text-[10px] font-black px-3 py-1 bg-primary-light rounded-full border border-primary-soft italic uppercase">Category</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {availableItems.map(itemKey => (
              <button
                key={itemKey}
                type="button"
                onClick={() => setItem(itemKey as ExpenseItem)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                  item === itemKey 
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105 z-10' 
                    : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{ItemIcons[itemKey as ExpenseItem]}</span>
                <span className="text-[10px] font-bold truncate w-full text-center">{ItemLabels[itemKey as ExpenseItem]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-text-main text-sm font-bold tracking-tight mb-3">消費說明</h3>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-text-main placeholder:text-slate-300 focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white h-24 resize-none transition-all outline-none text-sm" 
            placeholder="點擊相機辨識或在此手動輸入..."
          />
        </div>
      </div>

      <div className="sticky bottom-0 w-full bg-white border-t border-blue-50 pb-8 px-8 pt-6">
        <button 
          onClick={handleSave}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-5 rounded-[24px] shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 text-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined font-bold text-2xl">check_circle</span>
          確認儲存紀錄
        </button>
      </div>
    </div>
  );
};

export default ExpenseForm;
