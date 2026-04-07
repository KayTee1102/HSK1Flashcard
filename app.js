document.addEventListener('DOMContentLoaded', () => {
    const uploadSection = document.getElementById('upload-section');
    const controlsSection = document.getElementById('controls');
    const gridSection = document.getElementById('flashcard-grid');
    const fileInput = document.getElementById('jsonFileInput');
    const wordCountSpan = document.getElementById('word-count');
    const template = document.getElementById('card-template');
    
    // Nút điều khiển
    const btnShuffle = document.getElementById('btn-shuffle');
    const btnFlipAll = document.getElementById('btn-flip-all');
    
    let vocabularyData = [];
    let currentData = [];
    let allFlipped = false;
    
    // State quản lý từ vựng khó & đã học
    let learnedWords = JSON.parse(localStorage.getItem('hsk1_learned') || '[]');
    let hardWords = JSON.parse(localStorage.getItem('hsk1_hard') || '[]');

    // DOM Elements mới
    const progressCourse = document.getElementById('progress-course');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const learnedCountSpan = document.getElementById('learned-count');
    const totalCountSpan = document.getElementById('total-learned-target');
    const wordFilter = document.getElementById('word-filter');

    // 1. Tự động thử tải JSON qua Fetch API
    async function tryFetchLocalFile() {
        try {
            const response = await fetch('./hsk1_sample_data.json');
            if (response.ok) {
                const data = await response.json();
                handleDataLoaded(data);
                return true;
            }
        } catch (error) {
            console.warn("Fetch lỗi. Chuyển sang Upload Mode.");
        }
        return false;
    }

    function showUploadUI() {
        uploadSection.classList.remove('hidden');
    }

    tryFetchLocalFile().then(success => {
        if (!success) showUploadUI();
    });

    // Xử lý Upload File JSON Offline
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                uploadSection.classList.add('hidden');
                handleDataLoaded(data);
            } catch (err) {
                alert("File không đúng định dạng JSON!");
            }
        };
        reader.readAsText(file);
    });

    // Xử lý sau khi Load Data Thành Công
    function handleDataLoaded(data) {
        if (!Array.isArray(data)) {
            alert("File dữ liệu không phải là danh sách hợp lệ.");
            return;
        }
        vocabularyData = data;
        currentData = [...vocabularyData];
        
        wordCountSpan.textContent = vocabularyData.length;
        totalCountSpan.textContent = vocabularyData.length;
        
        controlsSection.classList.remove('hidden');
        progressCourse.classList.remove('hidden');
        gridSection.classList.remove('hidden');
        
        updateProgress();
        renderCards(currentData);
    }

    // Logic Cập nhật Tiến Trình
    function updateProgress() {
        const total = vocabularyData.length;
        if (total === 0) return;
        const count = learnedWords.length;
        const percentage = Math.round((count / total) * 100);
        
        learnedCountSpan.textContent = count;
        progressPercentage.textContent = percentage + '%';
        progressFill.style.width = percentage + '%';
        
        // Đổi màu khi hoàn thành
        if (percentage === 100) {
            progressFill.style.background = 'linear-gradient(135deg, #22c55e, #10b981)';
        } else {
            progressFill.style.background = 'var(--accent-gradient)';
        }
    }

    // Logic Bộ Lọc (Filter)
    wordFilter.addEventListener('change', (e) => {
        const filterVal = e.target.value;
        if (filterVal === 'all') {
            currentData = [...vocabularyData];
        } else if (filterVal === 'hard') {
            currentData = vocabularyData.filter(item => hardWords.includes(item.id));
        } else {
            // Lọc theo từ loại (pos có chứa chuỗi)
            currentData = vocabularyData.filter(item => 
                item.part_of_speech && item.part_of_speech.includes(filterVal)
            );
        }
        document.getElementById('word-count').textContent = currentData.length;
        allFlipped = false;
        renderCards(currentData);
    });

    btnShuffle.addEventListener('click', () => {
        currentData.sort(() => Math.random() - 0.5);
        renderCards(currentData);
    });

    btnFlipAll.addEventListener('click', () => {
        allFlipped = !allFlipped;
        const cards = document.querySelectorAll('.flashcard');
        cards.forEach(card => {
            if (allFlipped) {
                card.classList.add('flipped');
            } else {
                card.classList.remove('flipped');
            }
        });
    });

    function speakWord(text, e) {
        e.stopPropagation(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    // Nút Đánh dấu từ Khó (Star)
    function toggleHardWord(id, btnElement, e) {
        e.stopPropagation();
        if (hardWords.includes(id)) {
            hardWords = hardWords.filter(wId => wId !== id);
            btnElement.classList.remove('active');
        } else {
            hardWords.push(id);
            btnElement.classList.add('active');
        }
        localStorage.setItem('hsk1_hard', JSON.stringify(hardWords));
        
        // Nếu đang ở mode filter "hard", việc bỏ sao sẽ ẩn luôn thẻ đỏ
        if (wordFilter.value === 'hard') {
            const wrapper = btnElement.closest('.flashcard-wrapper');
            if (wrapper) wrapper.classList.add('fade-out');
        }
    }

    // Nút Đánh dấu Đã Thuộc
    function toggleLearnedWord(id, btnElement, markerElement) {
        // e.stopPropagation() is not needed because it's inside the back card, but let's be safe inside click listener below
        if (learnedWords.includes(id)) {
            learnedWords = learnedWords.filter(wId => wId !== id);
            btnElement.classList.remove('active');
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Đánh dấu đã thuộc';
            markerElement.classList.add('hidden');
        } else {
            learnedWords.push(id);
            btnElement.classList.add('active');
            btnElement.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Hoàn tác (Chưa thuộc)';
            markerElement.classList.remove('hidden');
        }
        localStorage.setItem('hsk1_learned', JSON.stringify(learnedWords));
        updateProgress();
    }

    // Hàm Render Grid
    function renderCards(dataToRender) {
        gridSection.innerHTML = '';
        
        dataToRender.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const cardInner = clone.querySelector('.flashcard');
            
            clone.querySelector('.hanzi').textContent = item.word || '?';
            
            const btnSpeak = clone.querySelector('.btn-speak');
            btnSpeak.addEventListener('click', (e) => speakWord(item.word, e));
            
            // Xử lý nút Hard Word (Sao)
            const btnHard = clone.querySelector('.btn-hard');
            if (hardWords.includes(item.id)) btnHard.classList.add('active');
            btnHard.addEventListener('click', (e) => toggleHardWord(item.id, btnHard, e));

            // Xử lý Trạng thái Đã Học
            const marker = clone.querySelector('.status-marker');
            const btnLearned = clone.querySelector('.btn-learned');
            
            if (learnedWords.includes(item.id)) {
                marker.classList.remove('hidden');
                btnLearned.classList.add('active');
                btnLearned.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Hoàn tác (Chưa thuộc)';
            }
            
            btnLearned.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLearnedWord(item.id, btnLearned, marker);
            });
            
            // Mặt sau
            clone.querySelector('.pinyin').textContent = item.pinyin || '';
            clone.querySelector('.sino').textContent = item.sino_vietnamese || 'Đang cập nhật';
            clone.querySelector('.pos').textContent = item.part_of_speech || 'Từ vựng';
            clone.querySelector('.meaning').textContent = item.meaning || 'Nghĩa của từ';
            
            const exZh = clone.querySelector('.ex-zh');
            const exPinyin = clone.querySelector('.ex-pinyin');
            const exVi = clone.querySelector('.ex-vi');
            
            if (item.examples && item.examples.length > 0) {
                exZh.textContent = item.examples[0].zh || '';
                exPinyin.textContent = item.examples[0].pinyin || '';
                exVi.textContent = item.examples[0].vi || '';
            } else {
                clone.querySelector('.example-group').style.display = 'none';
            }

            cardInner.addEventListener('click', () => {
                cardInner.classList.toggle('flipped');
            });

            const wrapper = clone.querySelector('.flashcard-wrapper');
            wrapper.style.animationDelay = `${(index % 20) * 0.05}s`; // Giới hạn animate delay để không quá lâu

            gridSection.appendChild(clone);
        });
    }
});
