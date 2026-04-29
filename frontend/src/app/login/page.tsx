import Signin from "@/components/Auth/Signin";
import Image from "next/image";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="grid min-h-[620px] lg:grid-cols-[1fr_0.9fr]">
          <section className="flex items-center px-6 py-10 sm:px-12">
            <div className="w-full">
              <div className="mb-8">
                <Image
                  src="/images/logo/logo-dark.svg"
                  alt="Pepperone"
                  width={176}
                  height={32}
                  className="dark:hidden"
                  priority
                />
                <Image
                  src="/images/logo/logo.svg"
                  alt="Pepperone"
                  width={176}
                  height={32}
                  className="hidden dark:block"
                  priority
                />
              </div>
              <h1 className="mb-2 text-3xl font-bold text-dark dark:text-white">
                Acesse o admin
              </h1>
              <p className="mb-8 text-sm text-dark-4 dark:text-dark-6">
                Entre com seu usuario para gerenciar catalogo, clientes e permissoes.
              </p>
              <Signin />
            </div>
          </section>

          <aside className="hidden bg-[#111827] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3fc]">
                Pepperone Admin
              </p>
              <h2 className="mt-4 text-3xl font-bold">
                Operacao protegida para a equipe autorizada.
              </h2>
            </div>
            <p className="text-sm leading-6 text-slate-300">
              Sua sessao usa cookie httpOnly para chamadas ao backend e uma copia em
              session storage para manter a experiencia do painel durante a aba aberta.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
