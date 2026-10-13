// 时间轴实验的舞台与控件：一段代码 → 一条可任意定位的时间轴。
//
// 为什么自己建画布、不走 `ManimCard`：卡片是「跑一遍就完」的形态（实时播、进视口自动播），
// 而这里是「先收集、再回看」——核心包 `surface.createPlayback` 把整段代码收进一条
// master timeline，交回一个可 seek（帧级）/ play / pause / step 的控制器（见核心包
// engine/playback.ts）。画布与控件都归本组件管，卸载即销毁。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play, StepBack, StepForward } from 'lucide-react'
import type { Playback, Surface } from 'manim-live'
import { manimRenderer } from '../service'
import type { Translate } from '../i18n'

export function TimelineStage({ code, t }: { code: string; t: Translate }): ReactNode {
  const stage = useRef<HTMLDivElement | null>(null)
  const playback = useRef<Playback | null>(null)
  const surface = useRef<Surface | null>(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [building, setBuilding] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** 拖动之前是不是在播——松手后恢复（播放器的常规手感）。 */
  const resumeAfterScrub = useRef(false)

  useEffect(() => {
    let cancelled = false
    const build = async (): Promise<void> => {
      const host = stage.current
      if (host === null) return
      try {
        const created = await manimRenderer().createSurface(host)
        if (cancelled) {
          created.dispose()
          return
        }
        surface.current = created
        const show = await created.createPlayback(code)
        if (cancelled) {
          show.dispose()
          return
        }
        playback.current = show
        setDuration(show.duration())
        setTime(show.time())
        setBuilding(false)
      } catch (reason) {
        console.error('[manim-live] 时间轴构建失败:', reason)
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
          setBuilding(false)
        }
      }
    }
    void build()
    return () => {
      cancelled = true
      playback.current?.dispose()
      playback.current = null
      surface.current?.dispose()
      surface.current = null
    }
  }, [code])

  // 播放中逐帧刷时间读数（时间轴归核心，界面只是读表）。
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = (): void => {
      const show = playback.current
      if (show !== null) {
        setTime(show.time())
        if (show.state() !== 'playing') setPlaying(false)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [playing])

  const toggle = (): void => {
    const show = playback.current
    if (show === null) return
    if (show.state() === 'playing') {
      show.pause()
      setPlaying(false)
      setTime(show.time())
    } else {
      show.play()
      setPlaying(true)
    }
  }

  const step = (frames: number): void => {
    const show = playback.current
    if (show === null) return
    show.step(frames)
    setPlaying(false)
    setTime(show.time())
  }

  const seekTo = (seconds: number): void => {
    const show = playback.current
    if (show === null) return
    show.seek(seconds)
    setTime(show.time())
  }

  const ready = playback.current !== null && error === null
  const fps = playback.current?.fps() ?? 60
  const segments = ready ? playback.current!.segments() : []
  const disabled = !ready

  return (
    <section className="mr-preview">
      <div className="mr-tl">
        <div className="mr-tl-stage" ref={stage}>
          {building && <div className="mr-tl-veil">{t('tlBuilding')}</div>}
        </div>
        {error !== null && <p className="mr-tl-error" role="alert">{t('tlError', { message: error })}</p>}
        <div className="mr-tl-bar" data-disabled={disabled}>
          <button className="mr-iconbtn" type="button" disabled={disabled} aria-label={t('tlPrevFrame')} onClick={() => step(-1)}>
            <StepBack size={15} strokeWidth={1.6} />
          </button>
          <button className="mr-iconbtn" type="button" disabled={disabled} aria-label={playing ? t('tlPause') : t('tlPlay')} onClick={toggle}>
            {playing ? <Pause size={15} strokeWidth={1.6} /> : <Play size={15} strokeWidth={1.6} />}
          </button>
          <button className="mr-iconbtn" type="button" disabled={disabled} aria-label={t('tlNextFrame')} onClick={() => step(1)}>
            <StepForward size={15} strokeWidth={1.6} />
          </button>
          <div className="mr-tl-track-wrap">
            <input
              className="mr-tl-track"
              type="range"
              min={0}
              max={Math.max(duration, 0.001)}
              step={1 / fps}
              value={Math.min(time, duration)}
              disabled={disabled}
              aria-label={t('tlHint')}
              onPointerDown={() => {
                const show = playback.current
                if (show !== null && show.state() === 'playing') {
                  resumeAfterScrub.current = true
                  show.pause()
                  setPlaying(false)
                }
              }}
              onPointerUp={() => {
                if (resumeAfterScrub.current) {
                  resumeAfterScrub.current = false
                  playback.current?.play()
                  setPlaying(true)
                }
              }}
              onChange={(event) => seekTo(Number(event.target.value))}
            />
            {/* 段界刻度：一段（一 play 或一 wait）一条竖线 */}
            <div className="mr-tl-ticks" aria-hidden="true">
              {duration > 0 && segments.map((segment, index) =>
                segment.start > 0
                  ? <span key={index} style={{ left: `${(segment.start / duration) * 100}%` }} />
                  : null,
              )}
            </div>
          </div>
          <span className="mr-tl-time">{time.toFixed(1)} / {duration.toFixed(1)}s</span>
        </div>
      </div>
    </section>
  )
}
