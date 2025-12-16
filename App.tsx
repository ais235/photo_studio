import React, { useState, useCallback, useRef } from 'react';
import { generateImage, editImage, GeneratedImage } from './services/gemini';
import { Spinner } from './components/Spinner';

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ASPECT_RATIOS: { value: AspectRatio; label: string; dims: string }[] = [
  { value: '1:1', label: 'Квадрат', dims: 'w-6 h-6' },
  { value: '4:3', label: 'Стандарт', dims: 'w-8 h-6' },
  { value: '3:4', label: 'Портрет', dims: 'w-6 h-8' },
  { value: '16:9', label: 'Широкий', dims: 'w-10 h-5.5' },
  { value: '9:16', label: 'Мобильный', dims: 'w-5.5 h-10' },
];

const STYLES = [
  { id: 'none', label: 'Без стиля', prompt: '' },
  { id: 'realistic', label: 'Фотореализм', prompt: 'photorealistic, 8k, highly detailed, realistic lighting, photography' },
  { id: 'anime', label: 'Аниме', prompt: 'anime style, studio ghibli, vibrant colors, detailed' },
  { id: 'digital', label: 'Цифровой арт', prompt: 'digital art, concept art, trending on artstation, sharp focus' },
  { id: 'oil', label: 'Масло', prompt: 'oil painting, textured, classic art style, impressionism' },
  { id: 'cyberpunk', label: 'Киберпанк', prompt: 'cyberpunk, neon lights, futuristic, high tech, dark atmosphere' },
  { id: '3d', label: '3D Рендер', prompt: '3d render, unreal engine 5, octane render, ray tracing' },
];

const QUICK_EDITS = [
  { label: 'Улучшить качество', prompt: 'Enhance details, fix lighting, make it 4k high quality' },
  { label: 'Киберпанк фильтр', prompt: 'Apply cyberpunk neon lighting and futuristic vibe' },
  { label: 'Сделать мультяшным', prompt: 'Turn into a pixar style cartoon 3d render' },
  { label: 'Черно-белое', prompt: 'Make it artistic black and white photography' },
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState<string>("");
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Construct the full prompt with style and negative prompt
      let fullPrompt = prompt;
      if (selectedStyle.prompt) {
        fullPrompt += `, ${selectedStyle.prompt}`;
      }
      if (negativePrompt.trim()) {
        fullPrompt += ` --no ${negativePrompt}`;
      }

      const result = await generateImage(fullPrompt, aspectRatio);
      if (result) {
        setCurrentImage(result);
        setHistory((prev) => [...prev, result]);
        setActiveTab('edit'); 
        setEditPrompt(""); 
      } else {
        setError("Не удалось сгенерировать изображение. Попробуйте изменить запрос.");
      }
    } catch (err: any) {
      setError(err.message || "Произошла неизвестная ошибка.");
    } finally {
      setLoading(false);
    }
  }, [prompt, negativePrompt, selectedStyle, aspectRatio]);

  const handleEdit = useCallback(async () => {
    if (!currentImage || !editPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await editImage(currentImage.base64, currentImage.mimeType, editPrompt, aspectRatio);
      if (result) {
        setCurrentImage(result);
        setHistory((prev) => [...prev, result]);
        setEditPrompt(""); 
      } else {
        setError("Не удалось отредактировать изображение.");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка редактирования.");
    } finally {
      setLoading(false);
    }
  }, [currentImage, editPrompt, aspectRatio]);

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); 
      const previous = newHistory[newHistory.length - 1];
      setCurrentImage(previous);
      setHistory(newHistory);
    } else if (history.length === 1) {
       setCurrentImage(null);
       setHistory([]);
       setActiveTab('create');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const mimeType = result.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || file.type;
        const base64 = result.split(',')[1];
        
        const newImage = { base64, mimeType };
        setCurrentImage(newImage);
        setHistory([newImage]);
        setActiveTab('edit');
        setError(null);

        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const ratios: {val: AspectRatio, r: number}[] = [
            {val: '1:1', r: 1}, {val: '4:3', r: 1.33}, {val: '3:4', r: 0.75}, 
            {val: '16:9', r: 1.77}, {val: '9:16', r: 0.56}
          ];
          const closest = ratios.reduce((prev, curr) => 
            Math.abs(curr.r - ratio) < Math.abs(prev.r - ratio) ? curr : prev
          );
          setAspectRatio(closest.val);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = `data:${currentImage.mimeType};base64,${currentImage.base64}`;
    link.download = `ai-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fullImageUrl = currentImage
    ? `data:${currentImage.mimeType};base64,${currentImage.base64}`
    : null;

  return (
    <div className="flex h-full bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar */}
      <div className="w-80 lg:w-96 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Фото Студия
            </h1>
          </div>
          <p className="text-xs text-slate-500 ml-10">Gemini 2.5 Flash Image</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Tabs */}
          <div className="flex p-1 bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === 'create' 
                  ? 'bg-slate-700 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Генерация
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === 'edit' 
                  ? 'bg-slate-700 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Редактор
            </button>
          </div>

          {/* CREATE TAB */}
          {activeTab === 'create' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ваш запрос</label>
                <textarea
                  className="w-full h-28 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-slate-100 placeholder-slate-600 shadow-inner"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите изображение (например: футуристичный город на закате)..."
                />
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Негативный запрос (исключить)</label>
                 <input 
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Например: размыто, плохое качество, люди"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-100 placeholder-slate-600"
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Стиль</label>
                 <select
                    value={selectedStyle.id}
                    onChange={(e) => setSelectedStyle(STYLES.find(s => s.id === e.target.value) || STYLES[0])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                    {STYLES.map(style => (
                        <option key={style.id} value={style.id}>{style.label}</option>
                    ))}
                 </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Формат</label>
                <div className="grid grid-cols-5 gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                        aspectRatio === ratio.value
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
                      }`}
                      title={ratio.label}
                    >
                      <div className={`border-2 border-current rounded-sm mb-1 ${ratio.dims}`}></div>
                      <span className="text-[10px] font-medium">{ratio.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-900/20 active:scale-[0.98] flex justify-center items-center gap-2"
              >
                {loading ? <Spinner /> : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Сгенерировать
                  </>
                )}
              </button>
            </div>
          )}

          {/* EDIT TAB */}
          {activeTab === 'edit' && (
            <div className="space-y-6 animate-fade-in">
              {!currentImage ? (
                <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                   <p className="text-sm text-slate-400 mb-4">Изображение не выбрано</p>
                   <button 
                     onClick={() => setActiveTab('create')} 
                     className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline"
                   >
                     Сгенерировать
                   </button>
                   <span className="text-slate-600 mx-2">или</span>
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline"
                   >
                     Загрузить
                   </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Инструкция для ИИ</label>
                    <textarea
                      className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none text-slate-100 placeholder-slate-600 shadow-inner"
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Что изменить? (например: добавь солнцезащитные очки, измени фон на горы)..."
                    />
                  </div>
                  
                  {/* Quick Edits */}
                   <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Быстрые действия</label>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_EDITS.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => setEditPrompt(item.prompt)}
                                className="text-xs p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left truncate transition-colors"
                                title={item.label}
                            >
                                {item.label}
                            </button>
                        ))}
                      </div>
                   </div>

                  <div className="space-y-2 pt-2">
                     <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Целевой формат</span>
                     </label>
                     <div className="flex gap-2">
                        {ASPECT_RATIOS.map((ratio) => (
                            <button
                                key={ratio.value}
                                onClick={() => setAspectRatio(ratio.value)}
                                className={`flex-1 py-1.5 text-[10px] rounded border ${
                                    aspectRatio === ratio.value 
                                    ? 'bg-purple-900/50 border-purple-500 text-purple-200' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                            >
                                {ratio.label}
                            </button>
                        ))}
                     </div>
                  </div>

                  <button
                    onClick={handleEdit}
                    disabled={loading || !editPrompt.trim()}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98] flex justify-center items-center gap-2"
                  >
                    {loading ? <Spinner /> : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Применить
                      </>
                    )}
                  </button>
                </>
              )}

               {/* Global Upload Button */}
               <div className="pt-6 border-t border-slate-800">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Загрузить фото
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 bg-[#0f172a] relative flex flex-col h-full">
        
        {/* Top Toolbar */}
        <div className="h-14 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 z-20">
            <div className="text-xs text-slate-500">
                {currentImage ? (
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {activeTab === 'edit' ? 'Режим редактирования' : 'Режим просмотра'}
                    </span>
                ) : (
                    <span>Готов к работе</span>
                )}
            </div>
            <div className="flex gap-2">
                 <button
                    onClick={handleUndo}
                    disabled={history.length <= 1 || loading}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
                    title="Отменить"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <button
                    onClick={downloadImage}
                    disabled={!currentImage}
                    className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
                    title="Скачать"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
            </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
            
            {/* Checkerboard Pattern for Transparency */}
            <div className="absolute inset-0 z-0 opacity-20" 
                 style={{
                     backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                     backgroundSize: '20px 20px',
                     backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                 }}>
            </div>

            {loading && (
                <div className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center transition-opacity">
                    <div className="bg-slate-900/90 p-8 rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col items-center animate-pulse backdrop-blur-md">
                         <Spinner />
                         <p className="text-slate-200 font-medium mt-4 tracking-wide">Обработка...</p>
                         <p className="text-xs text-slate-500 mt-2">Gemini создает пиксели</p>
                    </div>
                </div>
            )}

            {error && (
              <div className="absolute bottom-8 z-40 bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl flex items-center gap-4 shadow-xl backdrop-blur-md max-w-lg mx-auto animate-bounce-in">
                 <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 <div>
                    <h3 className="font-bold text-sm text-red-400">Ошибка</h3>
                    <p className="text-sm opacity-90">{error}</p>
                 </div>
                 <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
            )}

            {fullImageUrl ? (
                <div className="relative z-10 shadow-2xl shadow-black rounded-lg overflow-hidden border border-slate-800 bg-slate-900 group max-w-full max-h-full flex">
                    <img 
                        src={fullImageUrl} 
                        alt="Generated Content" 
                        className="max-w-full max-h-[calc(100vh-160px)] object-contain w-auto h-auto"
                    />
                </div>
            ) : (
                <div className="text-center max-w-md p-12 border border-slate-800 rounded-3xl bg-slate-900/50 backdrop-blur-sm z-10">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-200 mb-2">Начните творить</h2>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        Создавайте потрясающие арты по тексту или загружайте свои фото для редактирования с помощью AI.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => setActiveTab('create')}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-colors"
                        >
                            Создать
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full font-medium transition-colors border border-slate-700"
                        >
                            Загрузить
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;