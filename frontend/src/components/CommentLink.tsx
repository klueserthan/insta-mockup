interface CommentLinkProps {
  text: string;
  url: string;
  onLinkClick: (url: string) => void;
}

export function CommentLink({ text, url, onLinkClick }: CommentLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onLinkClick(url);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={url}
      onClick={handleClick}
      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  );
}
