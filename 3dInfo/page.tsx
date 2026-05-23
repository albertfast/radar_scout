'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Screen } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { downloadImageUrl } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Home, Camera, BookOpen, Languages, Settings, Crown,
  Download, Sparkles, Wand2,
  ChevronRight, Send, Plus, Star, Zap,
  ArrowLeft, X, Check,
  ImagePlus,
  Globe, Bell, ShieldCheck, Info,
} from 'lucide-react';

// ============================================================
// 3D Background (Lazy loaded)
// ============================================================
import dynamic from 'next/dynamic';
const ThreeBackground = dynamic(() => import('@/components/app/ThreeBackground'), {
  ssr: false,
  loading: () => null,
});

// ============================================================
// Screen Components (separated files)
// ============================================================
import { PhotoEditScreen } from '@/components/app/screens/PhotoEditScreen';
import { LanguageScreen } from '@/components/app/screens/LanguageScreen';

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function BrioApp() {
  const {
    currentScreen, theme, subscription,
    updateStreak,
  } = useAppStore();

  useEffect(() => { updateStreak(); }, [updateStreak]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home': return <HomeScreen />;
      case 'photoEdit': return <PhotoEditScreen />;
      case 'imageCreate': return <ImageCreateScreen />;
      case 'homework': return <HomeworkScreen />;
      case 'language': return <LanguageScreen />;
      case 'settings': return <SettingsScreen />;
      case 'subscription': return <SubscriptionScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className={`relative h-dvh w-full overflow-hidden flex flex-col transition-colors duration-500 ${
      theme === 'dark' ? 'bg-[#080A0F] text-white' : 'bg-[#F7F8FA] text-gray-900'
    }`}>
      <ThreeBackground theme={theme} />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </div>
        {subscription === 'free' && <AdBanner />}
        <BottomNav />
      </div>
    </div>
  );
}

// ============================================================
// AD BANNER
// ============================================================
function AdBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-20 border-t border-amber-400/20 bg-[#1F1308]/90 backdrop-blur-sm"
    >
      <div className="flex items-center justify-center px-3 py-1.5 text-xs text-amber-300/90">
        <span className="flex items-center gap-1">
          <Crown className="w-3 h-3" />
          <span>Ad • </span>
          <button
            onClick={() => useAppStore.getState().navigate('subscription')}
            className="underline font-medium hover:text-amber-200 transition-colors"
          >
            Remove ads with Pro
          </button>
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================
// BOTTOM NAVIGATION
// ============================================================
function BottomNav() {
  const tr = useI18n();
  const { currentScreen, navigate, subscription } = useAppStore();
  const tabs: { id: Screen; icon: React.ReactNode; label: string; proOnly?: boolean }[] = [
    { id: 'home', icon: <Home className="w-5 h-5" />, label: tr('nav.home') },
    { id: 'photoEdit', icon: <Camera className="w-5 h-5" />, label: tr('nav.photoEdit') },
    { id: 'imageCreate', icon: <ImagePlus className="w-5 h-5" />, label: tr('nav.imageCreate'), proOnly: true },
    { id: 'homework', icon: <BookOpen className="w-5 h-5" />, label: tr('nav.homework') },
    { id: 'language', icon: <Languages className="w-5 h-5" />, label: tr('nav.language') },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: tr('nav.settings') },
  ];

  return (
    <nav className="relative z-20 border-t backdrop-blur-xl bg-black/55 dark:bg-black/55 bg-white/75 border-white/10 dark:border-white/10 border-gray-200/60">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map((tab) => {
          const isActive = currentScreen === tab.id;
          const locked = tab.proOnly && subscription === 'free';
          return (
            <button
              key={tab.id}
              onClick={() => locked ? useAppStore.getState().navigate('subscription') : navigate(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all duration-200 min-w-0 flex-1 relative ${
                isActive ? 'text-cyan-300' : locked ? 'text-gray-500 opacity-60' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {isActive && (
                <motion.div layoutId="navIndicator" className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-cyan-400"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              <div className="relative">
                {tab.icon}
                {locked && <Crown className="w-2.5 h-2.5 absolute -top-1 -right-1 text-amber-400" />}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================================
// HOME SCREEN
// ============================================================
function HomeScreen() {
  const tr = useI18n();
  const { photosEdited, aiImagesCreated, homeworkSessions, streak, subscription, navigate } = useAppStore();
  const theme = useAppStore(s => s.theme);

  const stats = [
    { label: tr('home.stats.edited'), value: photosEdited, icon: <Camera className="w-4 h-4" />, iconBg: 'bg-rose-500/15 text-rose-300', accent: 'bg-rose-400' },
    { label: tr('home.stats.images'), value: aiImagesCreated, icon: <Sparkles className="w-4 h-4" />, iconBg: 'bg-cyan-500/15 text-cyan-300', accent: 'bg-cyan-400' },
    { label: tr('home.stats.homework'), value: homeworkSessions, icon: <BookOpen className="w-4 h-4" />, iconBg: 'bg-amber-500/15 text-amber-300', accent: 'bg-amber-400' },
    { label: tr('home.stats.streak'), value: streak, icon: <Zap className="w-4 h-4" />, iconBg: 'bg-emerald-500/15 text-emerald-300', accent: 'bg-emerald-400' },
  ];

  const features = [
    { id: 'photoEdit' as Screen, icon: <Camera className="w-6 h-6" />, title: tr('home.features.photoEdit'), desc: tr('home.features.photoEditDesc'), iconBg: 'bg-rose-500/15', iconText: 'text-rose-300' },
    { id: 'imageCreate' as Screen, icon: <Sparkles className="w-6 h-6" />, title: tr('home.features.imageCreate'), desc: tr('home.features.imageCreateDesc'), iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-300', proOnly: true },
    { id: 'homework' as Screen, icon: <BookOpen className="w-6 h-6" />, title: tr('home.features.homework'), desc: tr('home.features.homeworkDesc'), iconBg: 'bg-amber-500/15', iconText: 'text-amber-300' },
    { id: 'language' as Screen, icon: <Languages className="w-6 h-6" />, title: tr('home.features.language'), desc: tr('home.features.languageDesc'), iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300' },
  ];

  return (
    <div className="px-4 pt-12 pb-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-rose-300 bg-clip-text text-transparent">{tr('home.welcome')}</h1>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{tr('home.subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
            <Card className={`relative overflow-hidden p-3 backdrop-blur-sm border ${theme === 'dark' ? 'bg-white/[0.06] border-white/10' : 'bg-white/80 border-gray-200'}`}>
              <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} />
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>{stat.icon}</div>
                <span className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {subscription === 'free' && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <Card className={`p-4 cursor-pointer transition-all backdrop-blur-sm border ${theme === 'dark' ? 'bg-[#0E1A18]/90 border-emerald-400/20 hover:border-emerald-300/40' : 'bg-white border-emerald-200 hover:border-emerald-300'}`}
            onClick={() => navigate('subscription')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{tr('home.upgrade.title')}</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{tr('home.upgrade.desc')}</p>
              </div>
              <ChevronRight className={`w-5 h-5 flex-shrink-0 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          </Card>
        </motion.div>
      )}

      <div className="space-y-3">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tr('home.features.title')}</h2>
        {features.map((feature, i) => (
          <motion.div key={feature.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
            <Card className={`p-4 border-0 backdrop-blur-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all ${
              theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white/70 hover:bg-white/90 border border-gray-200/50'}`}
              onClick={() => { if (feature.proOnly && subscription === 'free') navigate('subscription'); else navigate(feature.id); }}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${feature.iconBg} ${feature.iconText} flex items-center justify-center flex-shrink-0`}>{feature.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{feature.title}</p>
                    {feature.proOnly && <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-400 border-0"><Crown className="w-2.5 h-2.5 mr-1" />Pro</Badge>}
                  </div>
                  <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{feature.desc}</p>
                </div>
                <ChevronRight className={`w-5 h-5 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// AI IMAGE CREATION SCREEN
// ============================================================
function ImageCreateScreen() {
  const tr = useI18n();
  const theme = useAppStore(s => s.theme);
  const navigate = useAppStore(s => s.navigate);
  const incrementAiImages = useAppStore(s => s.incrementAiImages);
  const subscription = useAppStore(s => s.subscription);

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const [size, setSize] = useState('square');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const styles = [
    { id: 'photorealistic', label: tr('create.style.photorealistic'), emoji: '📸' },
    { id: 'anime', label: tr('create.style.anime'), emoji: '🎨' },
    { id: 'digital', label: tr('create.style.digital'), emoji: '🖥️' },
    { id: 'oil', label: tr('create.style.oil'), emoji: '🖼️' },
    { id: 'watercolor', label: tr('create.style.watercolor'), emoji: '💧' },
    { id: 'pixel', label: tr('create.style.pixel'), emoji: '👾' },
    { id: 'sketch', label: tr('create.style.sketch'), emoji: '✏️' },
    { id: '3d', label: tr('create.style.3d'), emoji: '🧊' },
  ];

  const sizes = [
    { id: 'square', label: tr('create.size.square') },
    { id: 'portrait', label: tr('create.size.portrait') },
    { id: 'landscape', label: tr('create.size.landscape') },
    { id: 'wide', label: tr('create.size.wide') },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/image-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style, size }) });
      const data = await res.json();
      if (data.success) { setGeneratedImage(data.imageUrl); incrementAiImages(); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const downloadGenerated = async () => {
    if (!generatedImage) return;
    if (subscription === 'free') {
      navigate('subscription');
      return;
    }
    try {
      await downloadImageUrl(generatedImage, `brio-${Date.now()}.png`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate('home')} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold text-lg">{tr('create.title')}</h1>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div className={`aspect-square rounded-2xl overflow-hidden flex items-center justify-center ${theme === 'dark' ? 'bg-black/40 border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
          {generatedImage ? (
            <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
          ) : loading ? (
            <div className="text-center space-y-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Sparkles className="w-12 h-12 text-violet-500" /></motion.div>
              <p className="text-sm text-gray-400">{tr('create.generating')}</p>
            </div>
          ) : (
            <div className="text-center space-y-2 p-4">
              <Wand2 className={`w-12 h-12 mx-auto ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{tr('create.noImage')}</p>
            </div>
          )}
        </div>
        {generatedImage && (
          <div className="flex gap-2">
            <Button onClick={downloadGenerated} className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-purple-600"><Download className="w-4 h-4" /> {tr('create.download')}</Button>
            <Button onClick={() => { setGeneratedImage(null); setPrompt(''); }} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> {tr('create.createNew')}</Button>
          </div>
        )}
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tr('create.prompt')}
          className={`min-h-[80px] resize-none ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`} />
        <div className="space-y-2">
          <label className="text-sm font-medium">{tr('create.style')}</label>
          <div className="grid grid-cols-4 gap-2">
            {styles.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={`p-2 rounded-xl text-center transition-all text-xs ${style === s.id ? 'bg-violet-500/20 border border-violet-500/50 text-violet-400' : theme === 'dark' ? 'bg-white/5 border border-white/10 text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                <div className="text-lg mb-1">{s.emoji}</div><div className="truncate">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{tr('create.size')}</label>
          <div className="grid grid-cols-2 gap-2">
            {sizes.map((s) => (
              <button key={s.id} onClick={() => setSize(s.id)}
                className={`p-2.5 rounded-xl text-center transition-all text-xs ${size === s.id ? 'bg-violet-500/20 border border-violet-500/50 text-violet-400' : theme === 'dark' ? 'bg-white/5 border border-white/10 text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 gap-2">
          {loading ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles className="w-4 h-4" /></motion.div>{tr('create.generating')}</>) : (<><Wand2 className="w-4 h-4" />{tr('create.generate')}</>)}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// HOMEWORK HELPER SCREEN
// ============================================================
function HomeworkScreen() {
  const tr = useI18n();
  const theme = useAppStore(s => s.theme);
  const navigate = useAppStore(s => s.navigate);
  const incrementHomeworkSessions = useAppStore(s => s.incrementHomeworkSessions);
  const messages = useAppStore(s => s.homeworkMessages);
  const addHomeworkMessage = useAppStore(s => s.addHomeworkMessage);
  const clearHomeworkMessages = useAppStore(s => s.clearHomeworkMessages);
  const subject = useAppStore(s => s.homeworkSubject);
  const setSubject = useAppStore(s => s.setHomeworkSubject);
  const loading = useAppStore(s => s.homeworkLoading);
  const setLoading = useAppStore(s => s.setHomeworkLoading);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const subjects = ['math','science','history','literature','physics','chemistry','biology','geography','cs','other'];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() && !image) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMsg || 'Image uploaded' }];
    addHomeworkMessage(newMessages[newMessages.length - 1]);
    setLoading(true);
    try {
      const res = await fetch('/api/homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMessages, subject, imageBase64: image }) });
      const data = await res.json();
      if (data.success) {
        addHomeworkMessage({ role: 'assistant', content: data.reply || data.message });
        if (messages.length === 0) incrementHomeworkSessions();
      }
    } catch (err) {
      console.error(err);
      addHomeworkMessage({ role: 'assistant', content: 'Something went wrong. Please try again.' });
    } finally { setLoading(false); setImage(null); }
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => setImage(ev.target?.result as string); reader.readAsDataURL(file); } };
    input.click();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate('home')} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold text-lg">{tr('homework.title')}</h1>
        <Button variant="ghost" size="sm" onClick={clearHomeworkMessages} className="gap-1 text-xs"><Plus className="w-3.5 h-3.5" />{tr('homework.newSession')}</Button>
      </div>
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubject(s)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${subject === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50' : theme === 'dark' ? 'bg-white/5 text-gray-400 border border-white/10' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
              {tr(`homework.subjects.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}><Globe className={`w-8 h-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} /></div>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{tr('homework.noSessions')}</p>
          </div>
        ) : messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-md' : theme === 'dark' ? 'bg-white/10 text-white rounded-bl-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`}>
              <div className="flex gap-1">{[0,1,2].map((i) => (<motion.div key={i} animate={{ y: [0,-4,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} className="w-2 h-2 rounded-full bg-violet-500" />))}</div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>
      {image && (<div className="px-4 pb-2"><div className="relative inline-block"><img src={image} alt="Q" className="w-20 h-20 rounded-lg object-cover border border-white/20" /><button onClick={() => setImage(null)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><X className="w-3 h-3" /></button></div></div>)}
      <div className={`border-t ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white/80 border-gray-200'} backdrop-blur-xl px-3 py-3`}>
        <div className="flex items-center gap-2">
          <button onClick={handleImageUpload} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><Camera className="w-5 h-5 text-gray-400" /></button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={tr('homework.placeholder')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors ${theme === 'dark' ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-violet-500/50' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-violet-500'}`} />
          <Button onClick={sendMessage} disabled={loading || (!input.trim() && !image)} size="icon" className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600"><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function SettingsScreen() {
  const tr = useI18n();
  const { theme, toggleTheme, locale, setLocale, subscription, navigate, anonymousId } = useAppStore();
  const theme_val = useAppStore(s => s.theme);
  const locales = [
    { code: 'en' as const, name: 'English' }, { code: 'tr' as const, name: 'Türkçe' }, { code: 'es' as const, name: 'Español' },
    { code: 'fr' as const, name: 'Français' }, { code: 'de' as const, name: 'Deutsch' }, { code: 'ja' as const, name: '日本語' },
    { code: 'ko' as const, name: '한국어' }, { code: 'zh' as const, name: '中文' },
  ];
  const sections = [
    { items: [{ icon: theme === 'dark' ? <span className="w-5 h-5 flex items-center justify-center">🌙</span> : <span className="w-5 h-5 flex items-center justify-center">☀️</span>, label: tr('settings.theme'), right: <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} /> }, { icon: <Globe className="w-5 h-5" />, label: tr('settings.language'), value: locales.find((l) => l.code === locale)?.name || 'English', action: 'language' }] },
    { items: [{ icon: <Crown className="w-5 h-5 text-amber-500" />, label: tr('settings.subscription'), value: subscription === 'free' ? tr('sub.free') : subscription === 'weekly' ? tr('sub.weekly') : tr('sub.yearly'), action: 'subscription', badge: subscription === 'free' ? 'upgrade' : undefined }] },
    { items: [{ icon: <Bell className="w-5 h-5" />, label: tr('settings.notifications'), right: <Switch defaultChecked /> }, { icon: <ShieldCheck className="w-5 h-5" />, label: tr('settings.privacy'), action: 'privacy' }, { icon: <Info className="w-5 h-5" />, label: tr('settings.about'), right: <span className="text-xs text-gray-500">v2.0.0</span> }] },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate('home')} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold text-lg">{tr('settings.title')}</h1>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        <Card className={`p-4 border-0 ${theme_val === 'dark' ? 'bg-white/5' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
            <div className="flex-1"><p className="font-semibold text-sm">Brio User</p><p className={`text-xs ${theme_val === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>ID: {anonymousId.slice(0, 8)}...</p></div>
            <Badge variant={subscription === 'free' ? 'secondary' : 'default'} className={subscription !== 'free' ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-0' : ''}>{subscription === 'free' ? tr('sub.free') : 'PRO'}</Badge>
          </div>
        </Card>
        {sections.map((section, si) => (
          <Card key={si} className={`border-0 divide-y ${theme_val === 'dark' ? 'bg-white/5 divide-white/10' : 'bg-white divide-gray-100 border border-gray-200'}`}>
            {section.items.map((item, ii) => (
              <button key={ii} onClick={() => { if (item.action === 'subscription') navigate('subscription'); if (item.action === 'language') { const idx = locales.findIndex((l) => l.code === locale); setLocale(locales[(idx + 1) % locales.length].code); } }}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors">
                <div className="text-gray-400">{item.icon}</div>
                <div className="flex-1"><p className="text-sm font-medium">{item.label}</p></div>
                {item.badge === 'upgrade' && <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">PRO</Badge>}
                {item.value && <span className={`text-xs ${theme_val === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{item.value}</span>}
                {item.right}
              </button>
            ))}
          </Card>
        ))}
        <Card className={`p-4 border-0 cursor-pointer ${theme_val === 'dark' ? 'bg-white/5' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-3"><Star className="w-5 h-5 text-amber-500" /><span className="text-sm font-medium">{tr('settings.rate')}</span><div className="flex-1" /><div className="flex gap-0.5">{[1,2,3,4,5].map((s) => (<Star key={s} className="w-4 h-4 fill-amber-500 text-amber-500" />))}</div></div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// SUBSCRIPTION SCREEN
// ============================================================
function SubscriptionScreen() {
  const tr = useI18n();
  const theme = useAppStore(s => s.theme);
  const navigate = useAppStore(s => s.navigate);
  const { subscription, pendingSubscription, subscriptionNotice, requestSubscription, clearSubscriptionNotice, setSubscription } = useAppStore();
  const plans = [
    { id: 'free' as const, name: tr('sub.free'), price: tr('sub.price.free'), features: [{ label: tr('sub.limited'), included: true }, { label: tr('sub.withAds'), included: true }, { label: tr('sub.basicEdit'), included: true }, { label: tr('sub.sdExport'), included: true }, { label: tr('sub.features.aiImage'), included: false }, { label: tr('sub.features.hdExport'), included: false }], gradient: theme === 'dark' ? 'from-gray-500/20 to-gray-600/20' : 'from-gray-100 to-gray-200', border: theme === 'dark' ? 'border-white/10' : 'border-gray-200' },
    { id: 'weekly' as const, name: tr('sub.weekly'), price: tr('sub.price.weekly'), features: [{ label: tr('sub.features.unlimited'), included: true }, { label: tr('sub.features.noAds'), included: true }, { label: tr('sub.features.allFeatures'), included: true }, { label: tr('sub.features.priority'), included: true }, { label: tr('sub.features.hdExport'), included: true }, { label: tr('sub.features.advancedEdit'), included: true }], gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/50', popular: true },
    { id: 'yearly' as const, name: tr('sub.yearly'), price: tr('sub.price.yearly'), badge: tr('sub.price.yearlySave'), features: [{ label: tr('sub.features.unlimited'), included: true }, { label: tr('sub.features.noAds'), included: true }, { label: tr('sub.features.allFeatures'), included: true }, { label: tr('sub.features.priority'), included: true }, { label: tr('sub.features.hdExport'), included: true }, { label: tr('sub.features.aiImage'), included: true }], gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/50' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate('home')} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold text-lg">{tr('sub.title')}</h1>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {subscriptionNotice && (
          <Card className={`p-4 border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-400/30' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Checkout pending</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-amber-100/70' : 'text-amber-700'}`}>{subscriptionNotice}</p>
              </div>
              <button onClick={clearSubscriptionNotice} className="p-1 rounded-md hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          </Card>
        )}
        {plans.map((plan, i) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={`p-5 border-0 bg-gradient-to-br ${plan.gradient} relative overflow-hidden`}>
              {plan.popular && <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>}
              {plan.badge && <Badge className="bg-green-500/20 text-green-400 border-0 mb-2 text-[10px]">{plan.badge}</Badge>}
              <div className="flex items-center gap-2 mb-1">
                {plan.id !== 'free' && <Crown className="w-5 h-5 text-amber-500" />}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {subscription === plan.id && <Badge variant="secondary" className="text-[10px] bg-violet-500/20 text-violet-400 border-0 ml-auto">{tr('sub.current')}</Badge>}
              </div>
              <p className={`text-2xl font-bold mb-4 ${plan.id === 'free' ? '' : 'text-violet-400'}`}>{plan.price}</p>
              <div className="space-y-2">
                {plan.features.map((feature, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    {feature.included ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> : <X className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                    <span className={`text-xs ${feature.included ? '' : 'text-gray-500 line-through'}`}>{feature.label}</span>
                  </div>
                ))}
              </div>
              <Button className={`w-full mt-4 ${subscription === plan.id ? '' : plan.id === 'yearly' ? 'bg-gradient-to-r from-amber-600 to-orange-600' : plan.id === 'weekly' ? 'bg-gradient-to-r from-violet-600 to-purple-600' : ''}`}
                variant={subscription === plan.id ? 'outline' : 'default'}
                onClick={() => {
                  if (plan.id === 'free') setSubscription('free');
                  else requestSubscription(plan.id);
                }}>
                {subscription === plan.id ? tr('sub.current') : pendingSubscription === plan.id ? 'Checkout pending' : tr('sub.subscribe')}
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
