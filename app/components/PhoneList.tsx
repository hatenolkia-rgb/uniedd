import Image from "next/image";
import { PHONE_NUMBERS } from "../lib/site";

// Every UniEDD phone line as a tap-to-call link with its country flag.
export default function PhoneList({ className = "", linkClassName = "" }: { className?: string; linkClassName?: string }) {
  return (
    <ul className={className}>
      {PHONE_NUMBERS.map((phone) => (
        <li key={phone.tel}>
          <a href={`tel:${phone.tel}`} aria-label={`Call UniEDD ${phone.country}: ${phone.display}`} className={`inline-flex items-center gap-2 ${linkClassName}`}>
            <Image
              src={`https://flagcdn.com/w40/${phone.iso}.png`}
              alt=""
              width={20}
              height={14}
              unoptimized
              className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover"
            />
            <span className="whitespace-nowrap">{phone.display}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
