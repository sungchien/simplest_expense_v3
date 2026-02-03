
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableItems = Object.values(ExpenseItem);

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0 && description) {
      onSave(numAmount, item, description);
    } else {
      alert('請填寫完整資訊（金額需大於 0 且包含說明）');
    }
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
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
    if (!capturedImage) {
      alert("請先點擊右上角相機拍攝或選擇收據圖片");
      return;
    }

    // 根據使用者要求，直接設定金鑰
    const targetKey = "AIzaSyDo9o-Ecga3o6vtJAcBXHFQI2DZgVIg_Ec";
    
    setIsScanning(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: targetKey });
      const base64Content = capturedImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Content, mimeType: "image/jpeg" } },
            { text: "辨識此收據。請僅以 JSON 格式回傳結果：{\"amount\": number, \"description\": \"店家或商品名稱\", \"item\": \"food|transport|housing|shopping|entertainment|clothing|health|other\"}" }
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
      setCapturedImage(null);
    } catch (error: any) {
      console.error("[AI] 辨識錯誤:", error);
      alert("AI 辨識失敗，請確認網路連線或重試一次。");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* 頂部導覽列 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 ios-blur sticky top-0 z-20 border-b border-blue-50">
        <button 
          onClick={onCancel}
          className="text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined font-bold">close</span>
          <span className="text-sm font-bold">取消編輯</span>
        </button>
        <h2 className="text-text-main font-black italic">{title}</h2>
        <button 
          onClick={handleScanClick}
          className="size-10 bg-primary-light text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-2xl font-bold">photo_camera</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 掃描等待畫面 */}
        {isScanning && (
          <div className="absolute inset-0 bg-primary/60 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
            <h3 className="text-white text-2xl font-black italic tracking-tight">Gemini 辨識中</h3>
            <p className="text-white/70 text-sm mt-2">正在分析圖片中的消費明細...</p>
          </div>
        )}

        {/* 圖片預覽與辨識按鈕 */}
        {capturedImage && (
          <div className="p-6 bg-white border-b border-blue-50 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-3">
               <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">已選取收據圖片</h4>
               <button onClick={() => setCapturedImage(null)} className="text-slate-400">
                 <span className="material-symbols-outlined text-sm">cancel</span>
               </button>
            </div>
            <div className="flex gap-4">
              <img src={capturedImage} className="size-20 object-cover rounded-xl border-2 border-white shadow-sm" />
              <button 
                onClick={performAiRecognition}
                className="flex-1 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                使用 AI 自動填表
              </button>
            </div>
          </div>
        )}

        {/* 金額輸入區 */}
        <div className="py-12 flex flex-col items-center bg-primary-light/20">
          <p className="text-primary font-black tracking-[0.3em] mb-2 text-[10px] uppercase opacity-40">消費總額</p>
          <div className="flex items-center justify-center">
            <span className="text-text-main text-5xl font-black mr-2">$</span>
            <input 
              autoFocus
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent border-none p-0 text-text-main text-6xl font-black w-48 text-left focus:ring-0 placeholder:text-blue-200 tracking-tighter" 
              placeholder="0" 
            />
          </div>
        </div>

        {/* 表單內容 */}
        <div className="p-8 space-y-10 pb-32">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-text-main text-sm font-black">消費類別</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Category</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {availableItems.map(itemKey => (
                <button
                  key={itemKey}
                  onClick={() => setItem(itemKey as ExpenseItem)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                    item === itemKey 
                      ? 'bg-primary border-primary text-white shadow-xl scale-105 z-10' 
                      : 'bg-white border-slate-100 text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{ItemIcons[itemKey as ExpenseItem]}</span>
                  <span className="text-[10px] font-bold truncate w-full text-center">{ItemLabels[itemKey as ExpenseItem]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-text-main text-sm font-black mb-3">消費說明</h3>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-text-main placeholder:text-slate-300 focus:ring-4 focus:ring-primary/5 focus:border-primary h-32 resize-none transition-all outline-none text-sm leading-relaxed" 
              placeholder="例如：全家便利商店 - 雞肉握便當..."
            />
          </div>
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

      {/* 底部操作按鈕 */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 ios-blur border-t border-blue-50 flex gap-4 z-30">
        <button 
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-400 font-bold py-5 rounded-[24px] border border-slate-200 active:scale-95 transition-all"
        >
          取消
        </button>
        <button 
          onClick={handleSave}
          className="flex-[2] bg-primary hover:bg-primary-dark text-white font-black py-5 rounded-[24px] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 text-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined font-bold text-2xl">check_circle</span>
          確認儲存
        </button>
      </div>
    </div>
  );
};

export default ExpenseForm;
