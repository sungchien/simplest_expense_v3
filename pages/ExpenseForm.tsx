
import React, { useState, useRef } from 'react';
import { Expense, ExpenseItem } from '../types';
import { ItemLabels, ItemIcons } from './Dashboard';
import { GoogleGenAI, Type } from "@google/genai";

interface ExpenseFormProps {
  initialExpense?: Expense;
  onSave: (amount: number, item: ExpenseItem, description: string) => void;
  title: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialExpense, onSave, title }) => {
  const [amount, setAmount] = useState<string>(initialExpense?.amount.toString() || '');
  const [item, setItem] = useState<ExpenseItem>(initialExpense?.item || ExpenseItem.FOOD);
  const [description, setDescription] = useState<string>(initialExpense?.description || '');
  
  // 相機預覽與辨識狀態
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableItems = Object.values(ExpenseItem);

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
      setCapturedImage(base64Data); // 顯示照片縮圖
    } catch (error) {
      console.error("圖片載入錯誤:", error);
    }
  };

  const performAiRecognition = async () => {
    if (!capturedImage) return;

    setIsScanning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-09-2025',
        contents: {
          parts: [
            {
              inlineData: {
                data: capturedImage.split(',')[1],
                mimeType: "image/jpeg",
              },
            },
            {
              text: `你是一位專業的收據識別助手。分析這張圖片，根據圖片辨識其中的文字與推理，然後以 JSON 格式回傳 amount (消費金額)、description (消費的店家、商品)、item(從"food", "transport", "housing", "shopping", "entertainment", "clothing", "health", "other"等項目中選擇最可能者)。嚴禁回傳任何解釋文字。`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: "消費金額" },
              description: { type: Type.STRING, description: "店家或商品描述" },
              item: { type: Type.STRING, description: "分類名稱" }
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
      
      // 辨識成功後，可以保留縮圖作為對照，或清除以維持畫面簡潔
      // setCapturedImage(null); 
    } catch (error) {
      console.error("AI 辨識錯誤:", error);
      alert("AI 辨識失敗，請確保收據拍得清晰且完整，或嘗試手動輸入。");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      {/* AI 掃描動畫遮罩 */}
      {isScanning && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-10 text-center">
          <div className="relative mb-10">
            <div className="w-28 h-28 border-[6px] border-white/20 border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-5xl animate-pulse">qr_code_scanner</span>
            </div>
            {/* 掃描線效果 */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/60 shadow-[0_0_15px_white] animate-[bounce_2s_infinite]"></div>
          </div>
          <h3 className="text-white text-2xl font-black italic tracking-tight mb-2">AI 智慧分析中...</h3>
          <p className="text-white/80 text-sm font-medium">正在自動擷取收據上的金額與項目</p>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-8 px-6 relative">
        {/* 相機啟動按鈕 */}
        {!initialExpense && (
          <button 
            onClick={handleScanClick}
            className="absolute top-6 right-6 bg-white size-12 rounded-2xl shadow-xl border border-blue-50 text-primary flex items-center justify-center active:scale-90 transition-all z-10"
            title="啟動相機"
          >
            <span className="material-symbols-outlined text-2xl font-bold">photo_camera</span>
          </button>
        )}

        {/* 縮圖預覽區 */}
        {capturedImage && !initialExpense && (
          <div className="w-full flex flex-col items-center mb-8 animate-in zoom-in-95 duration-500">
            <div className="relative">
              <img 
                src={capturedImage} 
                alt="Receipt Preview" 
                className="w-40 h-40 object-cover rounded-[32px] border-4 border-white shadow-2xl rotate-1"
              />
              <button 
                onClick={() => setCapturedImage(null)}
                className="absolute -top-3 -right-3 bg-red-500 text-white size-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white active:scale-90"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <button 
              onClick={performAiRecognition}
              className="mt-6 bg-primary text-white px-8 py-3 rounded-full font-black italic tracking-wider shadow-xl shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
              進行辨識
            </button>
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

        <p className="text-primary font-bold tracking-[0.2em] mb-2 text-[10px] uppercase opacity-60">金額 (NT$)</p>
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
        
        <div className="flex items-center gap-1.5 mt-4 text-primary bg-primary-light px-4 py-1.5 rounded-full border border-primary-soft">
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          <p className="text-[10px] font-bold tracking-tight">
            {initialExpense ? new Date(initialExpense.timestamp).toLocaleString() : `今天, ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-t-[40px] flex-1 p-8 border-t border-blue-50 shadow-inner overflow-y-auto">
        {/* 支出項目 - 改為圖形化按鈕網格 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-text-main text-sm font-bold tracking-tight">支出項目</h3>
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
                    : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60 hover:opacity-100'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{ItemIcons[itemKey as ExpenseItem]}</span>
                <span className="text-[10px] font-bold truncate w-full text-center">{ItemLabels[itemKey as ExpenseItem]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-text-main text-sm font-bold tracking-tight mb-3">說明 (商店或商品)</h3>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-text-main placeholder:text-slate-300 focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white h-24 resize-none transition-all outline-none text-sm" 
            placeholder="點擊相機辨識或在此輸入詳細說明..."
          />
        </div>
      </div>

      <div className="sticky bottom-0 w-full bg-white border-t border-blue-50 pb-8 px-8 pt-6">
        <button 
          onClick={handleSave}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center gap-2 text-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined font-bold text-2xl">check_circle</span>
          確認儲存
        </button>
      </div>
    </div>
  );
};

export default ExpenseForm;
