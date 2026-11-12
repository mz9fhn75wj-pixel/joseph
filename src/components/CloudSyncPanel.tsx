import { useEffect, useState } from 'react'
import type { CloudSession } from '../utils/cloudSync'
import { cloudSyncConfigured } from '../utils/cloudSync'

interface CloudSyncPanelProps {
  session: CloudSession | null
  status: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onSignOut: () => void
  onUpload: () => Promise<void>
  onDownload: () => Promise<void>
}

export function CloudSyncPanel({ session, status, onSignIn, onSignUp, onSignOut, onUpload, onDownload }: CloudSyncPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { if (status) setMessage(status) }, [status])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setMessage('正在同步…')
    try { await action(); setMessage('同步完成。') } catch (error) { setMessage(error instanceof Error ? error.message : '同步失敗，請稍後再試。') } finally { setBusy(false) }
  }

  if (!cloudSyncConfigured) return <div className="cloud-sync-panel"><strong>雲端同步尚未設定</strong><small>需要先設定雲端資料庫；目前仍會保留本機存檔，不會遺失資料。</small></div>
  if (session) return <div className="cloud-sync-panel"><strong>雲端同步中</strong><small>{session.email}</small><div className="cloud-sync-actions"><button type="button" onClick={() => void run(onUpload)} disabled={busy}>上傳本機資料</button><button type="button" onClick={() => void run(onDownload)} disabled={busy}>下載雲端資料</button><button type="button" onClick={onSignOut}>登出</button></div><small>{message || '遊戲進度與此帳號的 MP3 歌單會自動同步。'}</small></div>
  return <div className="cloud-sync-panel"><strong>登入以同步所有裝置</strong><small>電腦與 iPhone 使用同一組帳號即可共用遊戲進度與個人 MP3 歌單。</small><input type="email" placeholder="電子郵件" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /><input type="password" placeholder="密碼" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={6} /><div className="cloud-sync-actions"><button type="button" onClick={() => void run(() => onSignIn(email.trim(), password))} disabled={busy}>登入並同步</button><button type="button" onClick={() => void run(() => onSignUp(email.trim(), password))} disabled={busy}>註冊帳號</button></div><small>{message || '密碼只會送到雲端登入服務，不會寫入遊戲存檔。'}</small></div>
}

