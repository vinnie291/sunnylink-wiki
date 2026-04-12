import json
import os

DATA_DIR = './data'
LOCALES = ['de', 'es', 'fr', 'ko', 'zh']

# Translations dictionary
TRANSLATIONS = {
    'de': {
        'OP Model 9': {
            'consensus': 'Extrem neue Veröffentlichung (10. April). Die Community stimmt derzeit über Feedback ab. Noch kein definitiver Konsens, stellt aber die neueste Iteration des Off-Policy-Trainings dar.',
            'note': 'Verfolgen Sie das Forum für frühes Feedback. Erste Berichte zu OP Model 8 wiesen auf Unruhe bei hohen Geschwindigkeiten hin; es bleibt abzuwarten, ob OP 9 dies behebt.'
        },
        'TCPmV3 (The Cool Peoples Model)': {
            'consensus': 'Hochgelobtes Community-Modell, das das Vertrauen in die Fahrt wiederherstellt. Bekannt für außergewöhnliche Geschmeidigkeit und Stabilität mit NNLC. Stabilisiert die Geschwindigkeit im E2E-Modus zuverlässig.',
            'note': 'Besonders beliebt bei Kia e-Niro und Honda Civic. Eines der besten benutzerdefinierten Modelle von Ende 2025.',
            'positives': ["Kein Ruckeln bei niedriger Geschwindigkeit", "Exzellente laterale Kontrolle", "Ultraglatte Übergänge", "Stabilisiert Geschwindigkeit im E2E", "Funktioniert gut mit NNLC"],
            'negatives': ["Spätes Bremsen (experimentelles Long)", "Fährt Kurven eng an", "Hält sich nachts ohne Führungsfahrzeug links"]
        },
        'Cool GWM (CGWM)': {
            'consensus': 'Auch als gWM10 bezeichnet. Ein viel genutztes Modell, das für konsistente Stopps an Ampeln und Schildern bekannt ist. Bietet ein ruhigeres Fahrgefühl als frühere Versionen.',
            'note': 'Beliebte Alternative für GWM-Plattformen, allerdings mit Tendenz zum Linkshalten.',
            'positives': ["Reaktionsschnelle Lenkung", "Konsistentes Anhalten an Ampeln/Schildern"],
            'negatives': ["Ausgeprägtes Linksfahren bei einigen", "Bremst ohne Grund hart (Long-Modus)"]
        },
        'gWM9': {
            'consensus': 'Vorgänger von Cool GWM und für viele der aktuelle "Maßstab". Bekannt für vertrauenswürdige laterale Kontrolle auf Toyota RAV4 und anderen Plattformen.',
            'note': 'Vermeidet das Linksfahren von CGWM, kann aber bei hohen Geschwindigkeiten in scharfen Kurven zum Übersteuern neigen.',
            'positives': ["Vermeidet Linksfahren (im Gegensatz zu CGWM)", "Vertrauenswürdige laterale Kontrolle"],
            'negatives': ["Leichtes Schwanken auf der Autobahn (langsames Ping-Pong)", "Übersteuern in scharfen Kurven bei hoher Geschwindigkeit"]
        }
    },
    'es': {
        'OP Model 9': {
            'consensus': 'Lanzamiento extremadamente nuevo (10 de abril). La comunidad está votando actualmente para recibir comentarios. Aún no hay un consenso definitivo, pero representa la última iteración del entrenamiento Off-Policy.',
            'note': 'Siga el foro para obtener comentarios iniciales. Los informes iniciales sobre OP Model 8 señalaron inestabilidad a altas velocidades; queda por ver si OP 9 resuelve esto.'
        },
        'TCPmV3 (The Cool Peoples Model)': {
            'consensus': 'Modelo de la comunidad muy elogiado que devuelve la confianza en la conducción. Conocido por su suavidad excepcional y estabilidad con NNLC. Estabiliza la velocidad de forma fiable en modo E2E.',
            'note': 'Especialmente popular entre los usuarios de Kia e-Niro y Honda Civic. Uno de los mejores modelos personalizados de finales de 2025.',
            'positives': ["Sin sacudidas a baja velocidad", "Excelente control lateral", "Transiciones ultrasuaves", "Estabiliza la velocidad en E2E", "Funciona bien con NNLC"],
            'negatives': ["Frenado tardío (long experimental)", "Toma las curvas cerradas", "Se pega a la izquierda de noche sin coche guía"]
        },
        'Cool GWM (CGWM)': {
            'consensus': 'También conocido como gWM10. Un modelo muy utilizado, destacado por su consistencia al detenerse en semáforos y señales. Se siente más suave que las versiones anteriores.',
            'note': 'Alternativa popular para plataformas GWM, aunque con tendencia a pegarse a la izquierda.',
            'positives': ["Dirección receptiva", "Paradas consistentes en semáforos/señales"],
            'negatives': ["Pegado a la izquierda pronunciado en algunos", "Frena fuerte sin motivo (modo long)"]
        },
        'gWM9': {
            'consensus': 'Predecesor de Cool GWM y para muchos el "modelo a batir" actual. Reconocido por su control lateral confiable en Toyota RAV4 y otras plataformas.',
            'note': 'Evita el pegado a la izquierda de CGWM, pero puede tender al sobreviraje en curvas cerradas a alta velocidad.',
            'positives': ["Evita pegarse a la izquierda (a diferencia de CGWM)", "Control lateral confiable"],
            'negatives': ["Balanceo lento en autopista (ping-pong lento)", "Sobreviraje en curvas cerradas a alta velocidad"]
        }
    },
    'fr': {
        'OP Model 9': {
            'consensus': 'Version extrêmement récente (10 avril). La communauté vote actuellement pour recueillir des avis. Pas encore de consensus définitif, mais représente la dernière itération de l\'entraînement Off-Policy.',
            'note': 'Suivez le forum pour les premiers retours. Les premiers rapports sur l\'OP Model 8 ont noté des saccades à haute vitesse ; reste à voir si l\'OP 9 résout cela.'
        },
        'TCPmV3 (The Cool Peoples Model)': {
            'consensus': 'Modèle communautaire très apprécié qui redonne confiance à la conduite. Connu pour sa douceur exceptionnelle et sa stabilité avec NNLC. Stabilise la vitesse de manière fiable en mode E2E.',
            'note': 'Particulièrement populaire auprès des utilisateurs de Kia e-Niro et Honda Civic. L\'un des meilleurs modèles personnalisés de fin 2025.',
            'positives': ["Pas de secousses à basse vitesse", "Excellent contrôle latéral", "Transitions ultrasuaves", "Stabilise la vitesse en E2E", "Fonctionne bien avec NNLC"],
            'negatives': ["Freinage tardif (long expérimental)", "Prend les virages serrés", "Colle à gauche la nuit sans voiture de tête"]
        },
        'Cool GWM (CGWM)': {
            'consensus': 'Également appelé gWM10. Un modèle très utilisé, réputé pour ses arrêts constants aux feux et aux panneaux. Plus doux que les versions précédentes.',
            'note': 'Alternative populaire pour les plateformes GWM, bien qu\'ayant tendance à coller à gauche.',
            'positives': ["Direction réactive", "Arrêts constants aux feux/panneaux"],
            'negatives': ["Collage à gauche prononcé pour certains", "Freine fort sans raison (mode long)"]
        },
        'gWM9': {
            'consensus': 'Prédécesseur du Cool GWM et pour beaucoup le "modèle à battre" actuel. Bien considéré pour son contrôle latéral fiable sur Toyota RAV4 et autres plateformes.',
            'note': 'Évite le collage à gauche du CGWM, mais peut avoir tendance au survirage dans les virages serrés à haute vitesse.',
            'positives': ["Évite de coller à gauche (contrairement au CGWM)", "Contrôle latéral fiable"],
            'negatives': ["Oscillation lente sur autoroute (ping-pong lent)", "Survirage dans les virages serrés à haute vitesse"]
        }
    },
    'ko': {
        'OP Model 9': {
            'consensus': '초기 릴리스(4월 10일). 현재 커뮤니티 피드백 투표 중입니다. 아직 명확한 합의는 없지만 최신 Off-Policy 학습 이터레이션을 나타냅니다.',
            'note': '초기 피드백을 위해 포럼을 확인하세요. OP Model 8에 대한 초기 보고서에서는 고속에서의 불안정성이 지적되었으며, OP 9에서 이를 해결했는지 지켜봐야 합니다.'
        },
        'TCPmV3 (The Cool Peoples Model)': {
            'consensus': '운전 신뢰도를 회복시켜주는 호평받는 커뮤니티 모델입니다. 탁월한 부드러움과 NNLC와의 안정성으로 유명합니다. E2E 모드에서 속도를 안정적으로 유지합니다.',
            'note': 'Kia e-Niro 및 Honda Civic 사용자들 사이에서 특히 인기가 높습니다. 2025년 말 최고의 커스텀 모델 중 하나입니다.',
            'positives': ["저속에서의 덜컥거림 없음", "탁월한 측면 제어", "매우 부드러운 전환", "E2E에서 속도 안정화", "NNLC와 잘 작동함"],
            'negatives': ["늦은 제동 (실험적 롱)", "코너를 빡빡하게 돔", "앞차 없는 야간에 왼쪽으로 쏠림"]
        },
        'Cool GWM (CGWM)': {
            'consensus': 'gWM10으로도 불립니다. 신호등과 표지판에서의 일관된 정지로 유명하며 널리 사용되는 모델입니다. 이전 버전에 비해 훨씬 부드러운 느낌을 줍니다.',
            'note': 'GWM 플랫폼에서 인기 있는 대안이지만 왼쪽으로 쏠리는 경향이 있습니다.',
            'positives': ["반응성 좋은 조향", "신호등/표지판에서의 일관된 정지"],
            'negatives': ["일부 차량에서 뚜렷한 왼쪽 쏠림", "이유 없는 급제동 (롱 모드)"]
        },
        'gWM9': {
            'consensus': 'Cool GWM의 전신이며 많은 이들에게 현재 "최고의 모델"로 평가받습니다. Toyota RAV4 및 기타 플랫폼에서 신뢰할 수 있는 측면 제어로 인정받고 있습니다.',
            'note': 'CGWM의 왼쪽 쏠림 문제를 피했지만, 고속에서의 급격한 코너링 시 오버스티어 경향이 있을 수 있습니다.',
            'positives': ["왼쪽 쏠림 방지 (CGWM과 달리)", "신뢰할 수 있는 측면 제어"],
            'negatives': ["고속도로에서의 느린 흔들림 (느린 핑퐁)", "고속 급코너에서의 오버스티어"]
        }
    },
    'zh': {
        'OP Model 9': {
            'consensus': '极新发布（4月10日）。社区目前正在进行反馈投票。尚无明确共识，但代表了 Off-Policy 训练的最新迭代。',
            'note': '请关注论坛以获取早期反馈。关于 OP Model 8 的初步报告指出其高速行驶时存在抖动；OP 9 是否解决了这一问题仍有待观察。'
        },
        'TCPmV3 (The Cool Peoples Model)': {
            'consensus': '广受赞誉的社区模型，重塑了驾驶信心。以其卓越的平滑度和 NNLC 的稳定性而闻名。在 E2E 模式下能可靠地稳定速度。',
            'note': '在 Kia e-Niro 和 Honda Civic 用户中特别受欢迎。2025 年底最佳自定义模型之一。',
            'positives': ["无低速顿挫感", "卓越的横向控制", "极度平滑的转换", "在 E2E 中稳定速度", "与 NNLC 配合良好"],
            'negatives': ["较晚的制动（实验性纵向）", "切弯较急", "夜间无前车时偏左行驶"]
        },
        'Cool GWM (CGWM)': {
            'consensus': '也称为 gWM10。一个被广泛使用的模型，以其在红绿灯和停车标志前的连贯停稳而著称。感觉比之前的版本更平滑。',
            'note': 'GWM 平台的受欢迎替代方案，但有靠左行驶的倾向。',
            'positives': ["转向响应灵敏", "在红绿灯/标志前停靠稳定"],
            'negatives': ["部分用户反映明显的靠左行驶", "无故急刹（纵向模式）"]
        },
        'gWM9': {
            'consensus': 'Cool GWM 的前身，被许多人视为目前的“标杆”。在 Toyota RAV4 等平台上以可靠的横向控制著称。',
            'note': '避开了 CGWM 的靠左问题，但在高速急转弯时可能存在过度转向的倾向。',
            'positives': ["避开了靠左倾向（与 CGWM 不同）", "可靠的横向控制"],
            'negatives': ["高速公路上的轻微摆动（慢速乒乓）", "高速急转弯时的过度转向"]
        }
    }
}

def apply_translations():
    for locale in LOCALES:
        locale_file = f'models.{locale}.json'
        locale_path = os.path.join(DATA_DIR, locale_file)
        
        if not os.path.exists(locale_path):
            print(f"File not found: {locale_file}")
            continue

        with open(locale_path, 'r', encoding='utf-8') as f:
            content = json.load(f)

        locale_trans = TRANSLATIONS.get(locale, {})

        for cat in content['categories']:
            for model in cat['models']:
                name = model['name']
                if name in locale_trans:
                    trans = locale_trans[name]
                    if 'consensus' in trans:
                        model['consensus'] = trans['consensus']
                    if 'note' in trans:
                        model['note'] = trans['note']
                    if 'positives' in trans:
                        model['positives'] = trans['positives']
                    if 'negatives' in trans:
                        model['negatives'] = trans['negatives']

        with open(locale_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
        print(f"✓ Applied translations for {locale_file}")

if __name__ == "__main__":
    apply_translations()
