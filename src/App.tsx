import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft, Clock, Send, MessageSquare, PenTool, FastForward, ChevronRight, Skull } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type Screen = 'START' | 'LOBBY' | 'INPUT_CUSTOM' | 'REVEAL' | 'WRITING' | 'DEBATE' | 'VOTING' | 'VOTE_RESULT' | 'RESULT';

interface GameSettings {
  impostorsKnowEachOther: boolean;
  revealSubCategory: boolean;
  giveImpostorClue: boolean;
  useTimer: boolean;
  writtenClues: boolean;
}

export default function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [screen, setScreen] = useState<Screen>('START');
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(CATEGORIES[0]);
  const [gameWord, setGameWord] = useState<GameItem | null>(null);
  const [impostorCount, setImpostorCount] = useState(1);
  const [settings, setSettings] = useState<GameSettings>({
    impostorsKnowEachOther: true,
    revealSubCategory: true,
    giveImpostorClue: true,
    useTimer: true,
    writtenClues: true
  });
  
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [turnInfo, setTurnInfo] = useState<any>({ starter: null, direction: 'Horario', chat: [], customWords: [], votes: {}, eliminated: [], round: 1 });

  // --- SINCRONIZACIÓN ONLINE ---
  useEffect(() => {
    if (mode !== 'ONLINE' || !roomCode) return;

    const roomSub = supabase.channel(`room-${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
        const data = payload.new;
        setScreen(data.game_state);
        setGameWord(data.game_word);
        setSettings(data.settings);
        if (data.turn_info) setTurnInfo(data.turn_info);
      }).subscribe();

    const playersSub = supabase.channel(`players-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` }, async () => {
        const { data } = await supabase.from('players').select('*').eq('room_code', roomCode).order('created_at');
        if (data) setPlayers(data);
      }).subscribe();

    return () => { supabase.removeChannel(roomSub); supabase.removeChannel(playersSub); };
  }, [mode, roomCode]);

  const createRoom = async () => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    const myId = Math.random().toString(36).substr(2, 9);
    
    const initialTurnInfo = { starter: null, direction: 'Horario', chat: [], customWords: [], votes: {}, eliminated: [], round: 1 };
    
    const { error: roomErr } = await supabase.from('rooms').insert([{ code, settings, game_state: 'LOBBY', turn_info: initialTurnInfo }]);
    if (roomErr) return alert('Error al crear sala: ' + roomErr.message);
    
    await supabase.from('players').insert([{ id: myId, room_code: code, name: currentPlayerName, is_host: true }]);

    setRoomCode(code); setPlayerId(myId); setIsHost(true); setMode('ONLINE'); setScreen('LOBBY');
  };

  const joinRoom = async (code: string) => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const cleanCode = code.toUpperCase();
    const { data: room, error: roomError } = await supabase.from('rooms').select('code').eq('code', cleanCode).single();
    if (roomError || !room) return alert('No se encontró la sala. Revisá el código.');

    const myId = Math.random().toString(36).substr(2, 9);
    await supabase.from('players').insert([{ id: myId, room_code: cleanCode, name: currentPlayerName }]);
    setRoomCode(cleanCode); setPlayerId(myId); setIsHost(false); setMode('ONLINE'); setScreen('LOBBY');
  };

  // MEMORIA DE PALABRAS PARA NO REPETIR
  const getUsedWords = (catId: string) => JSON.parse(localStorage.getItem('used_words_' + catId) || '[]');
  const addUsedWord = (catId: string, word: string) => {
    const used = getUsedWords(catId);
    localStorage.setItem('used_words_' + catId, JSON.stringify([...used, word]));
  };
  const getRandomWord = (items: any[], catId: string) => {
    let available = items.filter(i => !getUsedWords(catId).includes(i.name || i));
    if (available.length === 0) {
      localStorage.removeItem('used_words_' + catId);
      available = items;
    }
    const selected = available[Math.floor(Math.random() * available.length)];
    addUsedWord(catId, selected.name || selected);
    return typeof selected === 'string' ? { name: selected, sub: 'Amigo', clue: 'Alguien de la banda' } : selected;
  };

  const startOnlineGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    
    if (selectedCategory.isCustom) {
      await supabase.from('rooms').update({ game_state: 'INPUT_CUSTOM', turn_info: { ...turnInfo, customWords: [], eliminated: [], round: 1, chat: [], votes: {} } }).eq('code', roomCode);
      return;
    }

    const word = getRandomWord(selectedCategory.items, selectedCategory.id);
    
    // Fisher-Yates Shuffle para Impostores
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const imps = shuffled.slice(0, impostorCount).map(p => p.id);
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';

    for (const p of players) {
      await supabase.from('players').update({ is_ready: false, is_impostor: imps.includes(p.id), clue: '' }).eq('id', p.id);
    }
    await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, turn_info: { starter, direction, chat: [], votes: {}, eliminated: [], round: 1, customWords: [] }, settings }).eq('code', roomCode);
  };

  const startLocalGame = () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    if (selectedCategory.isCustom) {
      setScreen('INPUT_CUSTOM');
      return;
    }

    const word = getRandomWord(selectedCategory.items, selectedCategory.id);
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const imps = shuffled.slice(0, impostorCount).map(p => p.id);
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';
    
    setGameWord(word);
    setPlayers(players.map(p => ({ ...p, is_impostor: imps.includes(p.id), is_ready: false, clue: '' })));
    setTurnInfo({ starter, direction, chat: [], votes: {}, eliminated: [], round: 1, customWords: [] });
    setRevealedIdx(0);
    setScreen('REVEAL');
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR<br/>PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.7.0 - Rondas, Votos y Conocidos</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" style={{ marginBottom: '20px' }} />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: '1', name:currentPlayerName}]); setScreen('LOBBY'); setIsHost(true); }}>
              <User size={20} /> Modo Local (Un solo celu)
            </button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4>Modo Online (Varios celus)</h4>
              <button className="btn btn-accent" onClick={createRoom} style={{ marginBottom: '10px' }}>Crear Sala</button>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input className="input" placeholder="Código" maxLength={4} style={{ marginBottom: 0, textTransform: 'uppercase' }} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
                <button className="btn btn-primary" onClick={() => joinRoom(roomCode)}><LogIn size={18} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === 'LOBBY' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{mode === 'ONLINE' ? `SALA: ${roomCode}` : 'LOCAL'}</h3>
              <button className="btn btn-secondary" onClick={() => { setPlayers([]); setScreen('START'); }} style={{ width: 'auto', padding: '5px' }}><ArrowLeft size={16}/></button>
            </div>
            {mode === 'LOCAL' && (
              <div style={{ margin: '15px 0' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" onKeyDown={(e) => e.key === 'Enter' && setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}])} />
                  <button className="btn btn-primary" onClick={() => { setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}]); setCurrentPlayerName(''); }} style={{ width: 'auto' }}><UserPlus size={18}/></button>
                </div>
              </div>
            )}
            <div className="grid" style={{ margin: '15px 0' }}>
              {players.map(p => <div key={p.id} className={`btn ${p.id === playerId ? 'btn-accent' : 'btn-secondary'}`} style={{ fontSize: '0.7rem' }}>{p.name} {p.is_host && '👑'}</div>)}
            </div>
            {isHost && (
              <>
                <select className="input" onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ marginBottom: '15px' }}><label>Impostores: {impostorCount}</label>
                  <div className="grid">{[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{marginBottom: 0}}>{n}</button>)}</div>
                </div>
                <div className="card" style={{ background: '#f9f9f9', padding: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}><Settings size={16} /> Reglas Extra</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <ToggleButton label="Cronómetro (30s)" value={settings.useTimer} onClick={() => setSettings({...settings, useTimer: !settings.useTimer})} />
                    {!selectedCategory.isCustom && <ToggleButton label="Ver Sub-categoría" value={settings.revealSubCategory} onClick={() => setSettings({...settings, revealSubCategory: !settings.revealSubCategory})} />}
                    {!selectedCategory.isCustom && <ToggleButton label="Pista de Gemini" value={settings.giveImpostorClue} onClick={() => setSettings({...settings, giveImpostorClue: !settings.giveImpostorClue})} />}
                    <ToggleButton label="Impostores se conocen" value={settings.impostorsKnowEachOther} onClick={() => setSettings({...settings, impostorsKnowEachOther: !settings.impostorsKnowEachOther})} />
                    {mode === 'ONLINE' && <ToggleButton label="Debate Escrito" value={settings.writtenClues} onClick={() => setSettings({...settings, writtenClues: !settings.writtenClues})} />}
                  </div>
                </div>
                <button className="btn btn-accent" onClick={mode === 'LOCAL' ? startLocalGame : startOnlineGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            )}
            {!isHost && <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>Esperando al anfitrión...</p>}
          </div>
        )}

        {(screen !== 'START' && screen !== 'LOBBY') && (
          <GamePhase 
            screen={screen} setScreen={setScreen} mode={mode} 
            players={players} setPlayers={setPlayers} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx}
            gameWord={gameWord} setGameWord={setGameWord} settings={settings} roomCode={roomCode} isHost={isHost} turnInfo={turnInfo} setTurnInfo={setTurnInfo} getRandomWord={getRandomWord} impostorCount={impostorCount}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleButton({ label, value, onClick }: any) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center', marginBottom: '5px' }}>
      {label} <button onClick={onClick} className={`btn ${value ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '40px', padding: '5px', marginBottom: 0 }}>{value ? <Check size={14}/> : <X size={14}/>}</button>
    </label>
  );
}

function GamePhase({ screen, setScreen, mode, players, setPlayers, playerId, revealedIdx, setRevealedIdx, gameWord, setGameWord, settings, roomCode, isHost, turnInfo, setTurnInfo, getRandomWord, impostorCount }: any) {
  const [show, setShow] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [clueInput, setClueInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [customNames, setCustomNames] = useState(['', '', '']);
  const [localCustomWords, setLocalCustomWords] = useState<string[]>([]);
  const [localCustomIdx, setLocalCustomIdx] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const activePlayers = players.filter((p:any) => !(turnInfo?.eliminated || []).includes(p.id));
  const me = mode === 'LOCAL' ? activePlayers[revealedIdx] : players.find((p: any) => p.id === playerId) || players[0];
  const isImpostor = me?.is_impostor;
  const otherImpostors = activePlayers.filter((p:any) => p.is_impostor && p.id !== me?.id);
  const isEliminated = (turnInfo?.eliminated || []).includes(playerId);

  // Timer
  useEffect(() => {
    if (screen === 'REVEAL' && show && settings.useTimer && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [show, screen, timeLeft]);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turnInfo?.chat]);

  const handleNextStage = async (next: Screen) => {
    if (mode === 'LOCAL') setScreen(next);
    else await supabase.from('rooms').update({ game_state: next }).eq('code', roomCode);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isEliminated) return;
    const newChat = [...(turnInfo?.chat || []), { sender: me?.name, text: chatInput }];
    if (mode === 'LOCAL') {
      setTurnInfo({ ...(turnInfo || {}), chat: newChat });
    } else {
      await supabase.from('rooms').update({ turn_info: { ...(turnInfo || {}), chat: newChat } }).eq('code', roomCode);
    }
    setChatInput('');
  };

  if (screen === 'INPUT_CUSTOM') {
    const handleCustomSubmit = async () => {
      if (customNames.some(n => !n.trim())) return alert('Completá los 3 nombres');
      
      if (mode === 'LOCAL') {
        const newLocalWords = [...localCustomWords, ...customNames];
        setLocalCustomWords(newLocalWords);
        setCustomNames(['', '', '']);
        if (localCustomIdx < players.length - 1) {
          setLocalCustomIdx(localCustomIdx + 1);
        } else {
          const word = getRandomWord(newLocalWords, 'conocidos');
          const shuffled = [...players].sort(() => Math.random() - 0.5);
          const imps = shuffled.slice(0, impostorCount).map(p => p.id);
          setGameWord(word);
          setPlayers(players.map(p => ({ ...p, is_impostor: imps.includes(p.id) })));
          setTurnInfo({ ...(turnInfo || {}), customWords: newLocalWords });
          setScreen('REVEAL');
        }
      } else {
        const { data } = await supabase.from('rooms').select('turn_info').eq('code', roomCode).single();
        const currentWords = data?.turn_info?.customWords || [];
        await supabase.from('rooms').update({ turn_info: { ...(turnInfo || {}), customWords: [...currentWords, ...customNames] } }).eq('code', roomCode);
        await supabase.from('players').update({ is_ready: true }).eq('id', playerId);
      }
    };

    return (
      <div className="card">
        <h3>👥 Aportes de Conocidos</h3>
        <p style={{fontSize:'0.8rem'}}>Escribí 3 nombres de amigos o gente que todos conozcan.</p>
        {mode === 'LOCAL' && <p style={{fontWeight:'bold', color:'var(--celeste)'}}>Turno de: {players[localCustomIdx]?.name}</p>}
        {customNames.map((n, i) => (
          <input key={i} className="input" value={n} onChange={(e) => { const next = [...customNames]; next[i] = e.target.value; setCustomNames(next); }} placeholder={`Nombre ${i + 1}`} disabled={mode === 'ONLINE' && me?.is_ready} />
        ))}
        {mode === 'LOCAL' ? (
          <button className="btn btn-primary" onClick={handleCustomSubmit}>SIGUIENTE</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={handleCustomSubmit} disabled={me?.is_ready}>{me?.is_ready ? 'ENVIADO ✅' : 'ENVIAR NOMBRES'}</button>
            {isHost && (
              <button className="btn btn-accent" style={{marginTop:'20px'}} onClick={async () => {
                const { data } = await supabase.from('rooms').select('turn_info').eq('code', roomCode).single();
                const allWords = data?.turn_info?.customWords || [];
                if (allWords.length === 0) return alert('Nadie mandó nombres');
                const word = getRandomWord(allWords, 'conocidos');
                await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word }).eq('code', roomCode);
              }}>SORTEAR Y EMPEZAR JUEGO</button>
            )}
          </>
        )}
      </div>
    );
  }

  if (screen === 'REVEAL') {
    if (isEliminated) {
      return (
        <div className="card" style={{textAlign:'center'}}>
          <Skull size={48} color="#666" style={{margin:'0 auto 10px'}}/>
          <h3>Fuiste eliminado</h3>
          <p>Esperá a que los demás terminen la ronda.</p>
          {isHost && <button className="btn btn-accent" style={{marginTop:'15px', fontSize:'0.8rem'}} onClick={() => handleNextStage(settings.writtenClues ? 'WRITING' : 'DEBATE')}>AVANZAR A LA BANDA <ChevronRight size={16}/></button>}
        </div>
      );
    }
    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span className="btn btn-accent" style={{ width: 'auto' }}>Ronda {turnInfo?.round || 1} - Arranca: {turnInfo?.starter} ({turnInfo?.direction})</span>
        </div>
        <h3>{me?.name}, tu secreto</h3>
        <div className="role-reveal" onClick={() => setShow(!show)}>
          {!show ? 'TAP PARA VER' : (
            <div>
              {isImpostor ? (
                <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR
                  {settings.revealSubCategory && <p style={{color: '#333'}}>Tipo: {gameWord?.sub}</p>}
                  {settings.impostorsKnowEachOther && otherImpostors.length > 0 && <p style={{fontSize: '0.7rem', color: '#666'}}>Cómplices: {otherImpostors.map((p: any) => p.name).join(', ')}</p>}
                  {settings.giveImpostorClue && gameWord?.clue && <p style={{fontSize: '0.9rem', color: '#333'}}>💡 Pista: {gameWord?.clue}</p>}
                </div>
              ) : (
                <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}
                  {settings.revealSubCategory && <p style={{fontSize: '0.8rem', color: '#666'}}>({gameWord?.sub})</p>}
                </div>
              )}
              {settings.useTimer && <div style={{ marginTop: '10px', fontSize: '1.2rem' }}><Clock size={16}/> {timeLeft}s</div>}
            </div>
          )}
        </div>
        {show && (
          <div style={{ marginTop: '20px' }}>
            {mode === 'LOCAL' ? (
              <button className="btn btn-primary" onClick={() => { setShow(false); setTimeLeft(30); if (revealedIdx < activePlayers.length - 1) setRevealedIdx(revealedIdx + 1); else setScreen(settings.writtenClues ? 'WRITING' : 'DEBATE'); }}>SIGUIENTE</button>
            ) : (
              <>
                <button className={`btn ${me?.is_ready ? 'btn-secondary' : 'btn-primary'}`} onClick={async () => await supabase.from('players').update({ is_ready: true }).eq('id', playerId)}>
                  {me?.is_ready ? `LISTOS: ${players.filter((p:any)=>p.is_ready).length}/${activePlayers.length}` : 'YA LEÍ, ESTOY LISTO'}
                </button>
                {isHost && <button className="btn btn-accent" style={{marginTop:'15px', fontSize:'0.8rem'}} onClick={() => handleNextStage(settings.writtenClues ? 'WRITING' : 'DEBATE')}>AVANZAR A LA BANDA <ChevronRight size={16}/></button>}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (screen === 'WRITING') {
    return (
      <div className="card">
        <h3><PenTool size={20}/> Modo Escritura</h3>
        <p style={{fontSize:'0.8rem'}}>Escribí una pista sobre tu palabra.</p>
        <input className="input" value={clueInput} onChange={(e) => setClueInput(e.target.value)} placeholder="Ej: Es verde..." disabled={(mode === 'ONLINE' && !!me?.clue) || isEliminated} />
        <button className="btn btn-primary" onClick={async () => { if (mode === 'LOCAL') setScreen('DEBATE'); else await supabase.from('players').update({ clue: clueInput }).eq('id', playerId); }} disabled={(mode === 'ONLINE' && (!!me?.clue || !clueInput)) || isEliminated}>
          {mode === 'ONLINE' && me?.clue ? 'Enviado ✅' : 'ENVIAR PISTA'}
        </button>
        {isHost && mode === 'ONLINE' && <button className="btn btn-accent" style={{marginTop:'20px'}} onClick={() => handleNextStage('DEBATE')}>IR AL DEBATE</button>}
      </div>
    );
  }

  if (screen === 'DEBATE') {
    return (
      <div className="card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3><MessageSquare size={20}/> Debate de la Banda</h3>
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f0f0', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
          {settings.writtenClues && mode === 'ONLINE' && (
            <div style={{background:'white', padding:'8px', borderRadius:'8px', marginBottom:'10px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
              <strong>Pistas iniciales:</strong>
              {activePlayers.map((p:any) => <div key={p.id} style={{fontSize:'0.75rem', borderBottom:'1px solid #eee', padding:'5px 0'}}>• {p.name}: {p.clue || '...'}</div>)}
            </div>
          )}
          {(turnInfo?.chat || []).map((m: any, i: number) => ( <div key={i} style={{ marginBottom: '5px', background: 'white', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}><strong>{m.sender}:</strong> {m.text}</div> ))}
          <div ref={chatEndRef} />
        </div>
        {mode === 'ONLINE' && !isEliminated && (
          <div style={{ display: 'flex', gap: '5px' }}>
            <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{marginBottom: 0}} placeholder="Escribí acá..." onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} />
            <button className="btn btn-primary" onClick={sendChatMessage} style={{width: 'auto', marginBottom: 0}}><Send size={18}/></button>
          </div>
        )}
        {isHost && <button className="btn btn-accent" style={{ marginTop: '10px' }} onClick={() => handleNextStage('VOTING')}>IR A VOTAR</button>}
      </div>
    );
  }

  if (screen === 'VOTING') {
    const totalVotesCast = Object.keys(turnInfo?.votes || {}).length;
    
    return (
      <div className="card">
        <h3><CheckCircle2 size={20}/> Votación</h3>
        <p style={{textAlign:'center', fontSize:'0.8rem'}}>Votá por quién creés que es el impostor.</p>
        
        {isEliminated ? (
          <p style={{textAlign:'center', color:'red'}}>Estás eliminado, no podés votar.</p>
        ) : (
          <div className="grid">
            {activePlayers.map((p: any) => (
              <button key={p.id} className={`btn ${turnInfo?.votes?.[playerId] === p.id ? 'btn-primary' : 'btn-secondary'}`} onClick={async () => {
                if (mode === 'LOCAL') {
                  setTurnInfo({ ...(turnInfo || {}), votes: { ...(turnInfo?.votes || {}), localVote: p.id } }); // Local votes are direct
                } else {
                  await supabase.from('rooms').update({ turn_info: { ...(turnInfo || {}), votes: { ...(turnInfo?.votes || {}), [playerId]: p.id } } }).eq('code', roomCode);
                }
              }}>
                {p.name}
              </button>
            ))}
          </div>
        )}

        {isHost && (
          <div style={{marginTop:'20px', borderTop:'2px solid #eee', paddingTop:'10px', textAlign:'center'}}>
            {mode === 'ONLINE' && <p>Votos emitidos: {totalVotesCast} / {activePlayers.length}</p>}
            <button className="btn btn-accent" onClick={() => handleNextStage('VOTE_RESULT')}>TERMINAR VOTACIÓN Y VER RESULTADO</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'VOTE_RESULT') {
    const votes = turnInfo?.votes || {};
    let votedId = mode === 'LOCAL' ? votes.localVote : null;
    
    if (mode === 'ONLINE') {
      const counts: Record<string, number> = {};
      Object.values(votes).forEach((id: any) => { counts[id] = (counts[id] || 0) + 1; });
      const keys = Object.keys(counts);
      votedId = keys.length > 0 ? keys.reduce((a, b) => counts[a] > counts[b] ? a : b) : null;
    }

    const votedPlayer = players.find((p: any) => p.id === votedId);
    
    const nextRound = async () => {
      const newEliminated = [...(turnInfo?.eliminated || []), votedId];
      const remainingImps = players.filter((p:any) => p.is_impostor && !newEliminated.includes(p.id)).length;
      
      if (remainingImps > 0 && activePlayers.length - 1 > remainingImps) {
        let word;
        if (turnInfo?.customWords && turnInfo?.customWords.length > 0) {
          word = getRandomWord(turnInfo?.customWords, 'conocidos');
        } else {
          word = getRandomWord(selectedCategory.items, selectedCategory.id);
        }
        
        if (mode === 'LOCAL') {
          setGameWord(word); setTurnInfo({ ...(turnInfo || {}), eliminated: newEliminated, votes: {}, round: (turnInfo?.round || 1) + 1 });
          setRevealedIdx(0); setScreen('REVEAL');
        } else {
          for (const p of players) await supabase.from('players').update({ is_ready: false, clue: '' }).eq('id', p.id);
          await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, turn_info: { ...(turnInfo || {}), eliminated: newEliminated, votes: {}, round: (turnInfo?.round || 1) + 1, chat: [] } }).eq('code', roomCode);
        }
      } else {
        handleNextStage('RESULT');
      }
    };

    return (
      <div className="card" style={{textAlign:'center'}}>
        <h2>Resultado Votación</h2>
        <h3 style={{color:'var(--accent)'}}>{votedPlayer?.name || 'Nadie'} fue el más votado.</h3>
        
        {isHost && (
          <div style={{marginTop:'20px'}}>
            <p>¿Era impostor?</p>
            <p style={{fontSize:'2rem'}}>{votedPlayer?.is_impostor ? 'SÍ 😈' : 'NO 😇'}</p>
            <button className="btn btn-primary" onClick={nextRound}>
              {players.filter((p:any) => p.is_impostor && !(turnInfo?.eliminated || []).includes(p.id) && p.id !== votedId).length > 0 ? 'QUEDAN IMPOSTORES (SIGUIENTE RONDA)' : 'VER RESULTADO FINAL'}
            </button>
          </div>
        )}
        {!isHost && <p>El anfitrión revelará si era el impostor...</p>}
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={48} color="var(--oro)" />
      <h2>RESULTADO FINAL</h2>
      <p>La palabra era: <strong>{gameWord?.name}</strong></p>
      <p>Todos los Impostores:</p>
      <div className="grid">{players.filter((p:any) => p.is_impostor).map((p:any) => <div key={p.id} className="btn btn-accent">{p.name}</div>)}</div>
      {isHost && <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={async () => { if (mode === 'LOCAL') setScreen('LOBBY'); else await supabase.from('rooms').update({ game_state: 'LOBBY', turn_info: { starter: null, direction: 'Horario', chat: [], customWords: [], votes: {}, eliminated: [], round: 1 } }).eq('code', roomCode); }}>OTRA PARTIDA</button>}
    </div>
  );
}
