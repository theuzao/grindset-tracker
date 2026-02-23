import { useState, useRef } from 'react';
import { User, Trophy, Star, TrendingUp, Flame, Calendar, Award, Camera, X, Upload, Palette } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { XPProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AttributeRadar, AttributeList } from '@/components/charts/AttributeRadar';
import { useCharacter, useXPEvents, useAchievements } from '@/database/hooks';
import { getXPProgressInLevel } from '@/features/gamification/constants';
import { characterRepository } from '@/database/repositories/characterRepository';

// Banners padrão
const DEFAULT_BANNERS = [
  // Gradientes
  { id: 'gradient-blue', name: 'Azul', style: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)' },
  { id: 'gradient-purple', name: 'Roxo', style: 'linear-gradient(135deg, #581c87 0%, #7c3aed 50%, #a78bfa 100%)' },
  { id: 'gradient-green', name: 'Verde', style: 'linear-gradient(135deg, #14532d 0%, #22c55e 50%, #4ade80 100%)' },
  { id: 'gradient-red', name: 'Vermelho', style: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f87171 100%)' },
  { id: 'gradient-orange', name: 'Laranja', style: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fb923c 100%)' },
  { id: 'gradient-pink', name: 'Rosa', style: 'linear-gradient(135deg, #831843 0%, #db2777 50%, #f472b6 100%)' },
  { id: 'gradient-cyan', name: 'Ciano', style: 'linear-gradient(135deg, #164e63 0%, #06b6d4 50%, #22d3ee 100%)' },
  { id: 'gradient-dark', name: 'Escuro', style: 'linear-gradient(135deg, #000000 0%, #1f2937 50%, #374151 100%)' },
  // Gradientes especiais
  { id: 'gradient-sunset', name: 'Pôr do Sol', style: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)' },
  { id: 'gradient-ocean', name: 'Oceano', style: 'linear-gradient(135deg, #0f172a 0%, #0ea5e9 50%, #06b6d4 100%)' },
  { id: 'gradient-forest', name: 'Floresta', style: 'linear-gradient(135deg, #052e16 0%, #166534 50%, #22c55e 100%)' },
  { id: 'gradient-galaxy', name: 'Galáxia', style: 'linear-gradient(135deg, #0f0f23 0%, #581c87 40%, #1e3a8a 70%, #0f172a 100%)' },
  // Cores sólidas
  { id: 'solid-dark', name: 'Preto', style: '#0a0a0a' },
  { id: 'solid-gray', name: 'Cinza', style: '#1f2937' },
  { id: 'solid-blue', name: 'Azul Sólido', style: '#1e40af' },
  { id: 'solid-purple', name: 'Roxo Sólido', style: '#6b21a8' },
];

export function Character() {
  const character = useCharacter();
  const xpEvents = useXPEvents(20);
  const achievements = useAchievements();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleSelectBanner = async (banner: typeof DEFAULT_BANNERS[0]) => {
    await characterRepository.updateBanner(banner.style);
    setShowBannerPicker(false);
  };

  const getBannerStyle = () => {
    if (!character?.banner) return undefined;

    // Se começa com 'linear-gradient' ou '#', é um banner padrão (CSS)
    if (character.banner.startsWith('linear-gradient') || (character.banner.startsWith('#') && character.banner.length <= 9)) {
      return { background: character.banner };
    }

    // Caso contrário, é uma imagem base64
    return {
      backgroundImage: `url(${character.banner})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  };

  const compressImage = (base64: string, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = base64;
    });
  };

  const handleImageUpload = async (
    file: File,
    type: 'avatar' | 'banner',
    setLoading: (loading: boolean) => void
  ) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    setLoading(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(file);
      });

      const compressedImage = await compressImage(base64, type === 'avatar' ? 200 : 600);

      if (type === 'avatar') {
        await characterRepository.updateAvatar(compressedImage);
      } else {
        await characterRepository.updateBanner(compressedImage);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (window.confirm('Remover foto de perfil?')) {
      await characterRepository.updateAvatar(null);
    }
  };

  const handleRemoveBanner = async () => {
    await characterRepository.updateBanner(null);
  };

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const xpProgress = getXPProgressInLevel(character.totalXP);
  const unlockedAchievements = achievements?.filter(a => a.isUnlocked) ?? [];

  return (
    <div className="min-h-screen">
      <Header
        title="Personagem"
        subtitle="Seu perfil e evolução"
      />

      <div className="p-6 space-y-6">
        {/* Character Profile with Banner */}
        <Card variant="glow" className="overflow-hidden">
          {/* Banner */}
          <div
            className="relative h-40 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent"
            style={getBannerStyle()}
          >
            <div className="absolute bottom-3 right-3 flex gap-2 z-10">
              <button
                type="button"
                onClick={() => setShowBannerPicker(true)}
                disabled={isUploadingBanner}
                className="p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white transition-colors cursor-pointer"
                title="Alterar banner"
              >
                {isUploadingBanner ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Palette size={20} />
                )}
              </button>
              {character.banner && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="p-2 rounded-lg bg-black/70 hover:bg-red-500/70 text-white transition-colors cursor-pointer"
                  title="Remover banner"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          <CardContent className="-mt-16 relative">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
              {/* Avatar */}
              <div className="relative group">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'avatar', setIsUploadingAvatar);
                    e.target.value = '';
                  }}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-32 h-32 rounded-full bg-bg-secondary border-4 border-bg-secondary overflow-hidden shadow-xl">
                  {character.avatar ? (
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                      <User size={64} className="text-accent" />
                    </div>
                  )}
                </div>

                {/* Avatar overlay buttons */}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="p-2 rounded-full bg-accent hover:bg-accent/80 text-white transition-colors"
                    title="Alterar foto"
                  >
                    {isUploadingAvatar ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera size={20} />
                    )}
                  </button>
                  {character.avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                      title="Remover foto"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                {/* Level badge */}
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {character.level}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left pt-4 md:pt-0">
                <h2 className="text-3xl font-bold text-white mb-1">{character.name}</h2>
                <p className="text-lg text-accent mb-4">{character.title}</p>

                <XPProgressBar
                  currentXP={xpProgress.currentLevelXP}
                  requiredXP={xpProgress.requiredXP}
                  level={character.level}
                  className="max-w-md mb-3"
                />


                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-accent" />
                    <span className="text-gray-400">XP Total:</span>
                    <span className="text-white font-medium">{character.totalXP.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star size={18} className="text-amber-400" />
                    <span className="text-gray-400">Gold:</span>
                    <span className="text-amber-400 font-medium">{character.gold.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame size={18} className="text-orange-400" />
                    <span className="text-gray-400">Streak:</span>
                    <span className="text-white font-medium">{character.streak.current} dias</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attributes */}
          <Card>
            <CardHeader>
              <CardTitle>Atributos</CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeRadar attributes={character.attributes} size="md" />
            </CardContent>
          </Card>

          {/* Attribute Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Atributos</CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeList attributes={character.attributes} />
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <Calendar size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{character.streak.longest}</div>
            <div className="text-xs text-gray-400">Maior Streak</div>
          </Card>
          <Card className="text-center p-4">
            <Trophy size={24} className="mx-auto text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-white">{unlockedAchievements.length}</div>
            <div className="text-xs text-gray-400">Conquistas</div>
          </Card>
          <Card className="text-center p-4">
            <Star size={24} className="mx-auto text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{character.level}</div>
            <div className="text-xs text-gray-400">Nível Atual</div>
          </Card>
          <Card className="text-center p-4">
            <Award size={24} className="mx-auto text-blue-400 mb-2" />
            <div className="text-lg font-bold text-white truncate">{character.title}</div>
            <div className="text-xs text-gray-400">Título</div>
          </Card>
        </div>

        {/* Recent XP Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-accent" />
              Histórico de XP
            </CardTitle>
          </CardHeader>
          <CardContent>
            {xpEvents && xpEvents.filter(e => e.amount > 0).length > 0 ? (
              <div className="space-y-2">
                {xpEvents.filter(e => e.amount > 0).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary"
                  >
                    <div>
                      <p className="text-sm text-white">{event.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant="accent">+{event.amount} XP</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">Nenhum evento de XP registrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Banner Picker Modal */}
      <Modal
        isOpen={showBannerPicker}
        onClose={() => setShowBannerPicker(false)}
        title="Escolher Banner"
        size="lg"
      >
        <div className="space-y-6">
          {/* Upload de imagem personalizada */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Enviar Imagem</h3>
            <input
              type="file"
              ref={bannerInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file, 'banner', setIsUploadingBanner);
                  setShowBannerPicker(false);
                }
                e.target.value = '';
              }}
              accept="image/*"
              className="hidden"
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
            >
              <Upload size={18} className="mr-2" />
              {isUploadingBanner ? 'Enviando...' : 'Escolher Imagem'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">Máximo 5MB. A imagem será redimensionada automaticamente.</p>
          </div>

          {/* Banners padrão */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Gradientes</h3>
            <div className="grid grid-cols-4 gap-3">
              {DEFAULT_BANNERS.filter(b => b.id.startsWith('gradient')).map((banner) => (
                <button
                  key={banner.id}
                  onClick={() => handleSelectBanner(banner)}
                  className={`h-16 rounded-lg transition-all hover:scale-105 hover:ring-2 hover:ring-white/50 ${
                    character.banner === banner.style ? 'ring-2 ring-accent' : ''
                  }`}
                  style={{ background: banner.style }}
                  title={banner.name}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Cores Sólidas</h3>
            <div className="grid grid-cols-4 gap-3">
              {DEFAULT_BANNERS.filter(b => b.id.startsWith('solid')).map((banner) => (
                <button
                  key={banner.id}
                  onClick={() => handleSelectBanner(banner)}
                  className={`h-16 rounded-lg transition-all hover:scale-105 hover:ring-2 hover:ring-white/50 ${
                    character.banner === banner.style ? 'ring-2 ring-accent' : ''
                  }`}
                  style={{ background: banner.style }}
                  title={banner.name}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          {character.banner && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Preview Atual</h3>
              <div
                className="h-24 rounded-lg"
                style={getBannerStyle()}
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowBannerPicker(false)}
            >
              Cancelar
            </Button>
            {character.banner && (
              <Button
                variant="danger"
                onClick={() => {
                  handleRemoveBanner();
                  setShowBannerPicker(false);
                }}
              >
                Remover Banner
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
