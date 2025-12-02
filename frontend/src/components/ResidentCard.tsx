import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { User, QrCode, ShieldCheck, Sparkles } from 'lucide-react';

export const ResidentCard: React.FC = () => {
    const [hasNFT, setHasNFT] = useState(false);

    // 3D Tilt Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]), { stiffness: 150, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]), { stiffness: 150, damping: 20 });

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    if (!hasNFT) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
                <div className="bg-blue-50 p-6 rounded-full">
                    <ShieldCheck className="w-16 h-16 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Become a Resident</h2>
                    <p className="text-gray-500 mt-2">
                        Get your digital resident card to access exclusive DAO features and track your local activities.
                    </p>
                </div>
                <button
                    onClick={() => setHasNFT(true)}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                    Apply for Residency
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 perspective-1000">
            <motion.div
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative w-full max-w-[360px] aspect-[1.58/1] rounded-2xl shadow-2xl cursor-pointer group"
            >
                {/* Card Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-800 to-blue-900 rounded-2xl overflow-hidden border border-white/20">
                    {/* Decorative Circles */}
                    <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-blue-500/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[100%] bg-purple-500/20 rounded-full blur-3xl" />

                    {/* Holographic Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Card Content */}
                    <div className="relative h-full p-6 flex flex-col justify-between text-white z-10">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg">
                                    <Sparkles className="w-5 h-5 text-yellow-300" />
                                </div>
                                <span className="font-bold tracking-wider text-sm opacity-90">MEOW DAO CITY</span>
                            </div>
                            <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono border border-white/20">
                                RESIDENT
                            </div>
                        </div>

                        {/* Main Info */}
                        <div className="flex items-center gap-4 mt-2">
                            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-200 to-gray-400 border-2 border-white/30 shadow-lg overflow-hidden relative">
                                <User className="w-full h-full p-4 text-gray-600 bg-white" />
                            </div>
                            <div>
                                <p className="text-xs text-blue-200 uppercase tracking-wider">Name</p>
                                <h3 className="text-xl font-bold tracking-wide">Taro Yamada</h3>
                                <p className="text-xs text-blue-200 uppercase tracking-wider mt-2">Resident ID</p>
                                <p className="font-mono text-sm tracking-widest opacity-90">8823 4910 2293</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-blue-300">ISSUED DATE</p>
                                <p className="text-xs font-medium">2025/12/03</p>
                            </div>
                            <QrCode className="w-10 h-10 text-white/80" />
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="mt-8 text-center">
                <p className="text-sm text-gray-500">Tap card to flip (Coming Soon)</p>
            </div>
        </div>
    );
};
