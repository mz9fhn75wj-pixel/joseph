interface PigIllustrationProps {
  className?: string
}

export function PigIllustration({ className = '' }: PigIllustrationProps) {
  return <div className={`pet-illustration pig-illustration ${className}`.trim()} role="img" aria-label="噗比，一隻灰色布偶小豬">
    <span className="pig-ear left" /><span className="pig-ear right" />
    <span className="pig-face"><i className="eye left-eye" /><i className="eye right-eye" /><i className="cheek left-cheek" /><i className="cheek right-cheek" /><i className="pig-snout"><b /><b /></i></span>
    <span className="pig-body" /><span className="pig-tail" />
  </div>
}
