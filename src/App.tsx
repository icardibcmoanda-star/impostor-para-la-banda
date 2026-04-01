import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft, Clock, Send, CheckCircle2, FastForward, ChevronRight, MessageSquare, PenTool, Skull, Eye, EyeOff, Plus, Minus, HelpCircle } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type PlayMode = 'CLASSIC' | 'BLIND';
type Screen = 'START' | 'LOBBY' | 'INPUT_CUSTOM' | 'REVEAL' | 'DEBATE' | 'VOTING' | 'VOTE_RESULT' | 'RESULT';

interface GameSettings {
  impostorsKnowEachOther: boolean; revealSubCategory: boolean; giveImpostorClue: boolean; useTimer: boolean; writtenClues: boolean; playMode: PlayMode;
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
  const [impostorWord, setImpostorWord] = useState<GameItem | null>(null);
  const [impostorCount, setImpostorCount] = useState(1);
  const [settings, setSettings] = useState<GameSettings>({ impostorsKnowEachOther: true, revealSubCategory: true, giveImpostorClue: true, useTimer: true, writtenClues: true, playMode: 'CLASSIC' });
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [turnInfo, setTurnInfo] = useState<any>({ chat: [], customWords: [], votes: {}, eliminated: [], round: 1, winner: null, turn_order: [], current_turn_idx: 0 });

  // --- SINCRONIZACIÓN ---
  useEffect(() => {
    if (mode !== 'ONLINE' || !roomCode) return;

    const fetchInitialData = async () => {
      try {
        const { data: roomData } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
        if (roomData) {
          if (roomData.game_state) setScreen(roomData.game_state);
          if (roomData.game_word) setGameWord(roomData.game_word);
          if (roomData.turn_info?.impostor_word) setImpostorWord(roomData.turn_info.impostor_word);
          if (roomData.settings) setSettings(roomData.settings);
          if (roomData.turn_info) setTurnInfo(roomData.turn_info);
        }
        const { data: playersData } = await supabase.from('players').select('*').eq('room_code', roomCode).order('created_at');
        if (playersData) setPlayers(playersData);
      } catch (err) {
        console.error("Error cargando sala:", err);
      }
    };

    fetchInitialData();

    const roomSub = supabase.channel(`room-${roomCode}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
      const data = payload.new;
      if (data.game_state) setScreen(data.game_state);
      if (data.game_word) setGameWord(data.game_word);
      if (data.turn_info?.impostor_word) setImpostorWord(data.turn_info.impostor_word);
      if (data.settings) setSettings(data.settings);
      if (data.turn_info) setTurnInfo(data.turn_info);
    }).subscribe();

    const playersSub = supabase.channel(`players-${roomCode}`).on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` }, async () => {
      const { data } = await supabase.from('players').select('*').eq('room_code', roomCode).order('created_at');
      if (data) setPlayers(data);
    }).subscribe();

    return () => { supabase.removeChannel(roomSub); supabase.removeChannel(playersSub); };
  }, [mode, roomCode]);

  const shuffleArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };

  const getRandomWord = (items: any[], catId: string) => {
    const usedKey = 'used_' + catId;
    let used = JSON.parse(localStorage.getItem(usedKey) || '[]');
    let available = items.filter(i => !used.includes(i.name || i));
    if (available.length === 0) { used = []; available = items; }
    const selected = available[Math.floor(Math.random() * available.length)];
    used.push(selected.name || selected);
    localStorage.setItem(usedKey, JSON.stringify(used));
    return typeof selected === 'string' ? { name: selected, sub: 'Amigo', clue: 'Alguien conocido' } : selected;
  };

  const getPairOfWords = (items: GameItem[], catId: string) => {
    // Agrupar por subcategoría
    const subs: Record<string, GameItem[]> = {};
    items.forEach(i => { if (!subs[i.sub]) subs[i.sub] = []; subs[i.sub].push(i); });
    const validSubs = Object.keys(subs).filter(s => subs[s].length >= 2);
    if (validSubs.length === 0) return { main: getRandomWord(items, catId), imp: getRandomWord(items, catId) };
    
    const chosenSub = validSubs[Math.floor(Math.random() * validSubs.length)];
    const pair = shuffleArray(subs[chosenSub]).slice(0, 2);
    return { main: pair[0], imp: pair[1] };
  };

  const createRoom = async () => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    const myId = Math.random().toString(36).substr(2, 9);
    try {
      await supabase.from('rooms').insert([{ code, settings, game_state: 'LOBBY', turn_info: { chat: [], customWords: [], votes: {}, eliminated: [], round: 1, winner: null, turn_order: [], current_turn_idx: 0 } }]);
      await supabase.from('players').insert([{ id: myId, room_code: code, name: currentPlayerName, is_host: true }]);
      setRoomCode(code); 
      setPlayerId(myId); 
      setIsHost(true); 
      setMode('ONLINE'); 
      setScreen('LOBBY');
      setPlayers([{ id: myId, room_code: code, name: currentPlayerName, is_host: true }]); // Set local player immediately
    } catch (err) {
      alert("Error creando sala. Revisá tu conexión.");
    }
  };

  const joinRoom = async (code: string) => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const myId = Math.random().toString(36).substr(2, 9);
    const cleanCode = code.trim().toUpperCase();
    const { error } = await supabase.from('players').insert([{ id: myId, room_code: cleanCode, name: currentPlayerName }]);
    if (error) return alert('No existe la sala o error al entrar');
    setRoomCode(cleanCode); setPlayerId(myId); setIsHost(false); setMode('ONLINE'); setScreen('LOBBY');
  };

  const startGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    
    try {
      let mainWord, impWord;
      if (settings.playMode === 'BLIND') {
        const pair = getPairOfWords(selectedCategory.items, selectedCategory.id);
        mainWord = pair.main; impWord = pair.imp;
      } else {
        mainWord = getRandomWord(selectedCategory.items, selectedCategory.id);
        impWord = null;
      }

      const shuffledPlayers = shuffleArray([...players]);
      const imps = shuffledPlayers.slice(0, impostorCount).map(p => p.id);
      const turnOrder = shuffleArray([...players]).map(p => p.id);

      if (mode === 'LOCAL') {
        if (selectedCategory.isCustom) { setScreen('INPUT_CUSTOM'); setRevealedIdx(0); return; }
        setGameWord(mainWord); setImpostorWord(impWord);
        setPlayers(players.map(p => ({ ...p, is_impostor: imps.includes(p.id), clue: '', custom_names: [] })));
        setTurnInfo({ starter: players.find(p=>p.id===turnOrder[0])?.name, direction: Math.random()>0.5?'Derecha':'Izquierda', chat: [], votes: {}, eliminated: [], round: 1, winner: null, turn_order: turnOrder, current_turn_idx: 0 });
        setRevealedIdx(0); setScreen('REVEAL');
      } else {
        if (selectedCategory.isCustom) { 
          const { error: customError } = await supabase.from('rooms').update({ 
            game_state: 'INPUT_CUSTOM', 
            turn_info: { eliminated: [], round: 1, chat: [], votes: {}, winner: null, turn_order: turnOrder, current_turn_idx: 0, customWords: [] } 
          }).eq('code', roomCode); 
          if (customError) throw new Error("Error al crear sala custom: " + customError.message);
          setScreen('INPUT_CUSTOM');
          return; 
        }
        
        // 1. Actualizar jugadores (quién es impostor, resetear pistas)
        // Lo hacemos uno por uno pero atrapando errores individuales
        for (const p of players) {
          const { error: pError } = await supabase.from('players').update({ 
            is_impostor: imps.includes(p.id), 
            clue: '', 
            custom_names: [] 
          }).eq('id', p.id);
          if (pError) console.error(`Error actualizando jugador ${p.name}:`, pError.message);
        }
        
        // 2. Actualizar el estado de la sala
        const { error: roomError } = await supabase.from('rooms').update({ 
          game_state: 'REVEAL', 
          game_word: mainWord, 
          turn_info: { 
            impostor_word: impWord,
            starter: players.find(p=>p.id===turnOrder[0])?.name, 
            direction: Math.random()>0.5?'Derecha':'Izquierda', 
            chat: [], 
            votes: {}, 
            eliminated: [], 
            round: 1, 
            winner: null, 
            turn_order: turnOrder, 
            current_turn_idx: 0 
          }, 
          settings 
        }).eq('code', roomCode);

        if (roomError) throw new Error("Error al actualizar sala: " + roomError.message);

        // 3. El Host cambia de pantalla localmente
        setGameWord(mainWord);
        setImpostorWord(impWord);
        setScreen('REVEAL');
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + (err.message || "Problema de conexión"));
    }
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.10.0 - MODO IMPOSTOR CIEGO</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: '1', name:currentPlayerName}]); setPlayerId('1'); setCurrentPlayerName(''); setScreen('LOBBY'); setIsHost(true); }}><User size={20} /> Modo Local</button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4>Modo Online</h4>
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
            <h3>{mode === 'ONLINE' ? `SALA: ${roomCode}` : 'MODO LOCAL'}</h3>
            {mode === 'LOCAL' && (
              <div style={{ margin: '15px 0' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" onKeyDown={(e) => e.key === 'Enter' && setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}])} />
                  <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return; setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}]); setCurrentPlayerName(''); }} style={{ width: 'auto' }}><UserPlus size={18}/></button>
                </div>
              </div>
            )}
            <div className="grid">
              {players.map(p => <div key={p.id} className={`btn ${p.id === playerId ? 'btn-accent' : 'btn-secondary'}`} style={{ fontSize: '0.7rem', position:'relative' }}>{p.name} {p.is_host && '👑'}{mode === 'LOCAL' && players.length > 1 && <X size={14} onClick={() => setPlayers(players.filter(pl => pl.id !== p.id))} style={{position:'absolute', right:'5px', color:'red'}} />}</div>)}
            </div>
            {isHost && (
              <>
                <select className="input" style={{marginTop:'15px'}} onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ marginBottom: '15px' }}><label>Impostores: {impostorCount}</label>
                  <div className="grid">{[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{marginBottom: 0}}>{n}</button>)}</div>
                </div>
                <div className="card" style={{ background: '#f9f9f9', padding: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}><Settings size={16} /> Reglas Extra</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                      <button onClick={() => setSettings({...settings, playMode: 'CLASSIC'})} className={`btn ${settings.playMode === 'CLASSIC' ? 'btn-primary' : 'btn-secondary'}`} style={{flex:1, fontSize:'0.7rem', marginBottom:0}}>CLÁSICO</button>
                      <button onClick={() => setSettings({...settings, playMode: 'BLIND'})} className={`btn ${settings.playMode === 'BLIND' ? 'btn-accent' : 'btn-secondary'}`} style={{flex:1, fontSize:'0.7rem', marginBottom:0}}>CIEGO 🙈</button>
                    </div>
                    <ToggleButton label="Cronómetro" value={settings.useTimer} onClick={() => setSettings({...settings, useTimer: !settings.useTimer})} />
                    <ToggleButton label="Pista Gemini" value={settings.giveImpostorClue} onClick={() => setSettings({...settings, giveImpostorClue: !settings.giveImpostorClue})} />
                    <ToggleButton label="Los impostores se conocen" value={settings.impostorsKnowEachOther} onClick={() => setSettings({...settings, impostorsKnowEachOther: !settings.impostorsKnowEachOther})} />
                    <ToggleButton label="Revelar subcategoría" value={settings.revealSubCategory} onClick={() => setSettings({...settings, revealSubCategory: !settings.revealSubCategory})} />
                  </div>
                </div>
                <button className="btn btn-accent" onClick={startGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            )}
          </div>
        )}

        {(screen !== 'START' && screen !== 'LOBBY') && (
          <GamePhase screen={screen} setScreen={setScreen} mode={mode} players={players} setPlayers={setPlayers} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx} gameWord={gameWord} setGameWord={setGameWord} impostorWord={impostorWord} setImpostorWord={setImpostorWord} settings={settings} roomCode={roomCode} isHost={isHost} turnInfo={turnInfo} setTurnInfo={setTurnInfo} getRandomWord={getRandomWord} impostorCount={impostorCount} selectedCategory={selectedCategory} shuffleArray={shuffleArray} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleButton({ label, value, onClick }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center', marginBottom: '5px' }}>
      <span>{label}</span>
      <button onClick={(e) => { e.preventDefault(); onClick(); }} className={`btn ${value ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '40px', padding: '5px', marginBottom: 0 }}>
        {value ? <Check size={14}/> : <X size={14}/>}
      </button>
    </div>
  );
}

function GamePhase({ screen, setScreen, mode, players, setPlayers, playerId, revealedIdx, setRevealedIdx, gameWord, setGameWord, impostorWord, setImpostorWord, settings, roomCode, isHost, turnInfo, setTurnInfo, getRandomWord, impostorCount, selectedCategory, shuffleArray }: any) {
  const [showSecret, setShowSecret] = useState(false);
  const [clueInput, setClueInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [customNames, setCustomNames] = useState(['', '', '']);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const turnOrder = turnInfo?.turn_order || [];
  const currentIdx = turnInfo?.current_turn_idx || 0;
  const currentTurnPlayerId = turnOrder[currentIdx];
  const isMyTurn = playerId === currentTurnPlayerId;
  const currentTurnPlayerName = players.find(p => p.id === currentTurnPlayerId)?.name;

  const activePlayers = players.filter((p:any) => !(turnInfo?.eliminated || []).includes(p.id));
  const me = mode === 'LOCAL' ? activePlayers[revealedIdx] : (players.find((p: any) => p.id === playerId) || players[0]);
  const isEliminated = (turnInfo?.eliminated || []).includes(playerId);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turnInfo?.chat]);

  const handleNextStage = async (next: Screen) => { if (mode === 'LOCAL') setScreen(next); else await supabase.from('rooms').update({ game_state: next }).eq('code', roomCode); };

  const submitOnlineClue = async () => {
    if (!clueInput.trim()) return alert('Escribí una pista');
    await supabase.from('players').update({ clue: clueInput }).eq('id', playerId);
    if (currentIdx < turnOrder.length - 1) await supabase.from('rooms').update({ turn_info: { ...turnInfo, current_turn_idx: currentIdx + 1 } }).eq('code', roomCode);
    else await supabase.from('rooms').update({ game_state: 'DEBATE' }).eq('code', roomCode);
    setClueInput(''); setShowSecret(false);
  };

  if (screen === 'REVEAL') {
    if (mode === 'LOCAL') {
      return (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}><span className="btn btn-accent" style={{ width: 'auto' }}>Arranca: {turnInfo?.starter}</span></div>
          <h3>Turno de: {activePlayers[revealedIdx]?.name}</h3>
          <div className="role-reveal" onClick={() => setShowSecret(!showSecret)}>
            {!showSecret ? 'TAP PARA VER' : (
              <div>
                {settings.playMode === 'BLIND' ? (
                  <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>TU PALABRA ES:<br/><strong>{activePlayers[revealedIdx]?.is_impostor ? impostorWord?.name : gameWord?.name}</strong></div>
                ) : (
                  activePlayers[revealedIdx]?.is_impostor ? <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR<br/><small>Pista: {gameWord?.clue}</small></div> : <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}</div>
                )}
              </div>
            )}
          </div>
          {showSecret && <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={() => { setShowSecret(false); if (revealedIdx < activePlayers.length - 1) setRevealedIdx(revealedIdx + 1); else setScreen('DEBATE'); }}>SIGUIENTE AMIGO</button>}
        </div>
      );
    }
    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}><span className="btn btn-accent" style={{ width: 'auto' }}>Ronda {turnInfo.round} - Turno de: {currentTurnPlayerName}</span></div>
        <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '10px', marginBottom: '15px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>PISTAS DADAS:</p>
          {turnOrder.slice(0, currentIdx).map((pid: string) => {
            const p = players.find(pl => pl.id === pid);
            return <div key={pid} style={{ fontSize: '0.85rem', borderBottom: '1px solid #eee', padding: '3px 0' }}>• {p?.name}: <strong>{p?.clue}</strong></div>;
          })}
        </div>
        {isMyTurn ? (
          <div style={{ border: '2px solid var(--celeste)', padding: '15px', borderRadius: '15px' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>Tu secreto, {me.name}</h4>
            <div className="role-reveal" onClick={() => setShowSecret(!showSecret)} style={{ marginBottom: '15px' }}>
              {!showSecret ? 'TAP PARA VER' : (
                <div>
                  {settings.playMode === 'BLIND' ? (
                    <div style={{ color: 'var(--accent)' }}><Info size={32}/><br/>TU PALABRA ES:<br/><strong>{me.is_impostor ? impostorWord?.name : gameWord?.name}</strong><br/>{settings.revealSubCategory && <small style={{color: '#666'}}><br/>Categoría: {me.is_impostor ? impostorWord?.sub : gameWord?.sub}</small>}</div>
                  ) : (
                    me.is_impostor ? <div style={{ color: '#E74C3C' }}><Ghost size={32}/><br/>SOS EL IMPOSTOR<br/>{settings.giveImpostorClue && <small>Pista: {gameWord?.clue}</small>}{settings.impostorsKnowEachOther && impostorCount > 1 && <div style={{marginTop: '10px', fontSize: '0.8rem', borderTop: '1px solid #ff9999', paddingTop: '5px'}}>Otros impostores: {players.filter((p: any) => p.is_impostor && p.id !== me.id).map((p: any) => p.name).join(', ') || 'Nadie'}</div>}</div> : <div style={{ color: 'var(--accent)' }}><Info size={32}/><br/>PALABRA: {gameWord?.name}<br/>{settings.revealSubCategory && <small style={{color: '#666'}}><br/>Categoría: {gameWord?.sub}</small>}</div>
                  )}
                </div>
              )}
            </div>
            <input className="input" value={clueInput} onChange={(e) => setClueInput(e.target.value)} placeholder="Tu pista..." style={{ marginBottom: '10px' }} />
            <button className="btn btn-primary" onClick={submitOnlineClue} disabled={!clueInput.trim()}>ENVIAR PISTA</button>
          </div>
        ) : <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}><p>Esperando a <strong>{currentTurnPlayerName}</strong>...</p></div>}
      </div>
    );
  }

  if (screen === 'DEBATE') {
    return (
      <div className="card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3>💬 Debate {mode === 'ONLINE' ? `Ronda ${turnInfo.round}` : ''}</h3>
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f0f0', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
          {mode === 'LOCAL' ? (
            <div style={{textAlign:'center', padding:'20px'}}><p>¡A debatir en voz alta!<br/>Arranca: <strong>{turnInfo?.starter}</strong></p></div>
          ) : (
            <>
              <div style={{background:'white', padding:'8px', borderRadius:'8px', marginBottom:'10px'}}>
                <strong>Pistas finales:</strong>
                {turnOrder.map((pid: any) => { const p = players.find(pl => pl.id === pid); return <div key={pid} style={{fontSize:'0.75rem'}}>• {p?.name}: {p?.clue}</div>; })}
              </div>
              {(turnInfo?.chat || []).map((m: any, i: number) => <div key={i} style={{ background: 'white', padding: '5px', borderRadius: '5px', marginBottom: '5px' }}><strong>{m.sender}:</strong> {m.text}</div>)}
              <div ref={chatEndRef} />
            </>
          )}
        </div>
        {mode === 'ONLINE' && !isEliminated && (
          <div style={{ display: 'flex', gap: '5px' }}>
            <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{marginBottom: 0}} />
            <button className="btn btn-primary" onClick={async () => { if(!chatInput.trim())return; const newChat = [...(turnInfo?.chat || []), {sender: me.name, text: chatInput}]; await supabase.from('rooms').update({ turn_info: {...turnInfo, chat: newChat} }).eq('code', roomCode); setChatInput(''); }} style={{width:'auto'}}><Send size={18}/></button>
          </div>
        )}
        {isHost && <button className="btn btn-accent" style={{marginTop:'10px'}} onClick={() => handleNextStage('VOTING')}>IR A VOTAR</button>}
      </div>
    );
  }

  if (screen === 'VOTING') {
    return (
      <div className="card">
        <h3><CheckCircle2 size={20}/> Votación</h3>
        <div className="grid">
          {activePlayers.map((p: any) => (
            <div key={p.id} style={{display:'flex', alignItems:'center', gap:'5px', marginBottom:'10px'}}>
              <button className={`btn ${turnInfo?.votes?.[playerId || 'local'] === p.id ? 'btn-primary' : 'btn-secondary'}`} style={{flex:1, marginBottom:0}} onClick={async () => {
                const newVotes = { ...(turnInfo?.votes || {}), [playerId || 'local']: p.id };
                if (mode === 'LOCAL') setTurnInfo({...turnInfo, votes: newVotes}); else await supabase.from('rooms').update({ turn_info: {...turnInfo, votes: newVotes} }).eq('code', roomCode);
              }} disabled={isEliminated && mode === 'ONLINE'}>{p.name}</button>
              {mode === 'LOCAL' && <div style={{display:'flex', gap:'5px'}}><Plus size={16} onClick={()=>{const v=turnInfo.votes||{}; v[p.id]=(v[p.id]||0)+1; setTurnInfo({...turnInfo, votes:{...v}})}}/><Minus size={16} onClick={()=>{const v=turnInfo.votes||{}; v[p.id]=Math.max(0,(v[p.id]||0)-1); setTurnInfo({...turnInfo, votes:{...v}})}}/><span style={{fontSize:'0.7rem'}}>{turnInfo?.votes?.[p.id]||0}</span></div>}
            </div>
          ))}
        </div>
        {isHost && <button className="btn btn-accent" style={{marginTop:'20px'}} onClick={() => handleNextStage('VOTE_RESULT')}>VER RESULTADO</button>}
      </div>
    );
  }

  if (screen === 'VOTE_RESULT') {
    const votes = turnInfo?.votes || {};
    let votedId = '';
    if (mode === 'LOCAL') votedId = Object.keys(votes).reduce((a, b) => (votes[a] > votes[b] ? a : b), activePlayers[0]?.id);
    else { const counts: any = {}; Object.values(votes).forEach((id: any) => counts[id] = (counts[id] || 0) + 1); votedId = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, activePlayers[0]?.id); }
    const votedPlayer = players.find(p => p.id === votedId);

    return (
      <div className="card" style={{textAlign:'center'}}>
        <h2>{votedPlayer?.name} eliminado.</h2>
        <p style={{fontSize:'2rem'}}>{votedPlayer?.is_impostor ? 'ERA IMPOSTOR 😈' : 'ERA INOCENTE 😇'}</p>
        <p style={{fontSize:'0.8rem', color:'#666', marginTop:'10px'}}>Su palabra era: <strong>{votedPlayer?.is_impostor ? impostorWord?.name || 'LA OTRA' : gameWord?.name}</strong></p>
        {isHost && <button className="btn btn-primary" onClick={async () => {
          const newEliminated = [...(turnInfo?.eliminated || []), votedId];
          const aliveImps = players.filter(p => p.is_impostor && !newEliminated.includes(p.id)).length;
          const aliveInnos = players.filter(p => !p.is_impostor && !newEliminated.includes(p.id)).length;
          if (aliveImps === 0 || aliveImps >= aliveInnos) {
            const winner = aliveImps === 0 ? 'INNOCENTS' : 'IMPOSTORS';
            if (mode === 'LOCAL') { setTurnInfo({...turnInfo, eliminated: newEliminated, winner}); setScreen('RESULT'); }
            else await supabase.from('rooms').update({ game_state: 'RESULT', turn_info: {...turnInfo, eliminated: newEliminated, winner} }).eq('code', roomCode);
          } else {
            const word = getRandomWord(selectedCategory.items, selectedCategory.id);
            const newTurnOrder = shuffleArray(players.filter(p => !newEliminated.includes(p.id)).map(p => p.id));
            if (mode === 'LOCAL') { setPlayers(players.map(p => ({...p, clue: ''}))); setTurnInfo({...turnInfo, eliminated: newEliminated, votes: {}, round: turnInfo.round + 1, turn_order: newTurnOrder, starter: players.find(p=>p.id===newTurnOrder[0])?.name }); setRevealedIdx(0); setScreen('REVEAL'); }
            else { 
              const pair = settings.playMode === 'BLIND' ? getPairOfWords(selectedCategory.items, selectedCategory.id) : { main: word, imp: null };
              await supabase.from('players').update({ clue: '' }).eq('room_code', roomCode); 
              await supabase.from('rooms').update({ 
                game_state: 'REVEAL', 
                game_word: pair.main, 
                turn_info: { 
                  ...turnInfo, 
                  impostor_word: pair.imp,
                  eliminated: newEliminated, 
                  votes: {}, 
                  round: turnInfo.round + 1, 
                  chat: [], 
                  turn_order: newTurnOrder, 
                  starter: players.find(p=>p.id===newTurnOrder[0])?.name 
                } 
              }).eq('code', roomCode); 
            }
          }
        }}>CONTINUAR</button>}
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={48} color="var(--oro)" />
      <h2>{turnInfo.winner === 'INNOCENTS' ? '¡GANARON LOS INOCENTES! 😇' : '¡GANARON LOS IMPOSTORES! 😈'}</h2>
      <p>La palabra de la mayoría era: <strong>{gameWord?.name}</strong></p>
      {settings.playMode === 'BLIND' && <p>La palabra del impostor era: <strong>{impostorWord?.name}</strong></p>}
      {isHost && <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={async () => { if (mode === 'LOCAL') setScreen('LOBBY'); else await supabase.from('rooms').update({ game_state: 'LOBBY', turn_info: { chat: [], customWords: [], votes: {}, eliminated: [], round: 1, winner: null, turn_order: [], current_turn_idx: 0 } }).eq('code', roomCode); }}>OTRA PARTIDA</button>}
    </div>
  );
}
