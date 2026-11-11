import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { navItems } from '../data'
import { MusicPlayer } from './MusicPlayer'
import { CloudSyncPanel } from './CloudSyncPanel'
import type { CloudSession } from '../utils/cloudSync'
import type { PetState, View } from '../types'

interface LayoutProps {
  activeView: View
  onNavigate: (view: View) => void
  playerName: string
  onPlayerNameChange: (name: string) => void
  pet: PetState
  notice: string
  soundEnabled: boolean
  onSoundToggle: () => void
  onExportSave: () => void
  onImportSave: (file: File) => void
  onResetSave: () => void
  cloudSession: CloudSession | null
  cloudStatus: string
  onCloudSignIn: (email: string, password: string) => Promise<void>
  onCloudSignUp: (email: string, password: string) => Promise<void>
  onCloudSignOut: () => void
  onCloudUpload: () => Promise<void>
  onCloudDownload: () => Promise<void>
  children: ReactNode
}

export function Layout({ activeView, onNavigate, playerName, onPlayerNameChange, pet, notice, soundEnabled, onSoundToggle, onExportSave, onImportSave, onResetSave, cloudSession, cloudStatus, onCloudSignIn, onCloudSignUp, onCloudSignOut, onCloudUpload, onCloudDownload, children }: LayoutProps) {
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(playerName)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => setDraftName(playerName), [playerName])
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  const saveName = (event: FormEvent) => {
    event.preventDefault()
    const nextName = draftName.trim().slice(0, 16)
    if (nextName) onPlayerNameChange(nextName)
    setEditingName(false)
  }

  const chooseSaveFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onImportSave(file)
    event.target.value = ''
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-icon">☯</span>
          <div>
            <strong>修仙伴讀</strong>
            <small>CULTIVATION COMPANION</small>
          </div>
        </div>
        <div className="sect-card">
          <span className="sect-seal">玄</span>
          <div>
            <small>目前道號</small>
            <strong>{playerName}的小築</strong>
          </div>
          <span className="online-dot" />
        </div>
        <nav className="main-nav" aria-label="主要導覽">
          {navItems.map((item) => (
            <button
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'study' && <span className="nav-badge">今日</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="streak-line"><span>☼</span> 每日伴讀守護中</div>
          <button className="profile-button"><span className="avatar">居</span><span>我的修士檔案</span><span>⋯</span></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-icon">☯</span><strong>修仙伴讀</strong></div>
          <div className="topbar-actions">
            <span className={`network-status ${online ? 'online' : 'offline'}`} role="status"><i />{online ? '已連線' : '離線模式'}</span>
            <button className="sound-toggle" type="button" onClick={onSoundToggle} aria-label={soundEnabled ? '關閉互動音效' : '開啟互動音效'} aria-pressed={soundEnabled}>{soundEnabled ? '♫' : '♪̸'}<span>{soundEnabled ? '音效開' : '音效關'}</span></button>
            <button className="icon-button" aria-label="通知">♧<span className="notification-dot" /></button>
            <div className="profile-wrap">
              <button className="user-chip" onClick={() => setEditingName((current) => !current)}><span className="avatar">居</span><span>{playerName}</span><span>⌄</span></button>
              {editingName && <form className="profile-popover" onSubmit={saveName}><label htmlFor="player-name">修士稱號</label><div><input id="player-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={16} autoFocus /><button type="submit">保存</button></div><div className="save-tools"><button type="button" onClick={onExportSave}>匯出存檔</button><label>匯入存檔<input type="file" accept="application/json,.json" onChange={chooseSaveFile} /></label></div><button type="button" className="reset-save-button" onClick={onResetSave}>重置遊戲資料</button><small className="save-note">遊戲進度可轉移；音樂檔案會留在原裝置。</small><CloudSyncPanel session={cloudSession} status={cloudStatus} onSignIn={onCloudSignIn} onSignUp={onCloudSignUp} onSignOut={onCloudSignOut} onUpload={onCloudUpload} onDownload={onCloudDownload} /></form>}
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <MusicPlayer />
      </main>
    </div>
  )
}
