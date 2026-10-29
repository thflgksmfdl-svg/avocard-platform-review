(() => {

  /*
   ============================================================
   이미지 링크 입력 영역
   아래 따옴표 안에 이미지 URL을 그대로 붙여 넣으세요.
   예시:
   step1: "https://example.com/step1.png"
   ============================================================
  */
  const IMAGE_URLS = {
    step1: "https://cdn.shopify.com/s/files/1/0622/3357/5595/files/step1.png?v=1785897450",
    address: "https://cdn.shopify.com/s/files/1/0622/3357/5595/files/adress.png?v=1785898492",
    step2: "https://cdn.shopify.com/s/files/1/0622/3357/5595/files/STEP2.png?v=1785897448",
    step3Pdf: "https://cdn.shopify.com/s/files/1/0622/3357/5595/files/STEP3.png?v=1785897448",
    step3A0: "https://cdn.shopify.com/s/files/1/0622/3357/5595/files/step3-1.png?v=1785897448"
  };



  const imageElements = [...document.querySelectorAll("img[data-image-key]")];

  imageElements.forEach((image) => {
    const key = image.dataset.imageKey;
    const url = IMAGE_URLS[key];

    if (url && !url.includes("_이미지_링크를_여기에_입력")) {
      image.src = url;
    } else {
      image.style.display = "none";

      const placeholder = document.createElement("div");
      placeholder.className = "image-placeholder";
      placeholder.textContent = "이 이미지 영역의 링크를 코드 상단 IMAGE_URLS에서 입력해 주세요.";

      image.parentElement.insertBefore(placeholder, image);
    }
  });

 const imageButtons=[...document.querySelectorAll(".guide-image")].filter((button)=>{
  const image=button.querySelector("img");
  return image && image.style.display!=="none" && image.src;
 });
 const lightbox=document.getElementById("lightbox");
 const stage=document.getElementById("lightboxStage");
 const title=document.getElementById("lightboxTitle");
 const closeButton=document.getElementById("closeButton");
 const prevButton=document.getElementById("prevButton");
 const nextButton=document.getElementById("nextButton");
 const copyAddress=document.getElementById("copyAddress");
 const copyToast=document.getElementById("copyToast");
 let index=0,lastFocus=null,timer=null;

 function render(i){
  const btn=imageButtons[i],src=btn.querySelector("img"),img=document.createElement("img");
  title.textContent=btn.dataset.title||"가이드 이미지";stage.innerHTML="";
  img.src=src.currentSrc||src.src;img.alt=src.alt;stage.appendChild(img);
 }
 function open(i){index=i;lastFocus=document.activeElement;render(index);lightbox.classList.add("is-open");lightbox.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");closeButton.focus()}
 function close(){lightbox.classList.remove("is-open");lightbox.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");if(lastFocus)lastFocus.focus()}
 function prev(){index=(index-1+imageButtons.length)%imageButtons.length;render(index)}
 function next(){index=(index+1)%imageButtons.length;render(index)}
 function toast(msg){copyToast.textContent=msg;copyToast.classList.add("show");clearTimeout(timer);timer=setTimeout(()=>copyToast.classList.remove("show"),1800)}

 imageButtons.forEach((button,index)=>{
  button.addEventListener("click",()=>{
   const image=button.querySelector("img");
   if(!image || !image.src || image.style.display==="none") return;
   open(index);
  });
 });
 closeButton.addEventListener("click",close);prevButton.addEventListener("click",prev);nextButton.addEventListener("click",next);
 lightbox.addEventListener("click",e=>{if(e.target===lightbox)close()});
 document.addEventListener("keydown",e=>{if(!lightbox.classList.contains("is-open"))return;if(e.key==="Escape")close();if(e.key==="ArrowLeft")prev();if(e.key==="ArrowRight")next()});



 copyAddress.addEventListener("click",async()=>{
  const value=copyAddress.dataset.copy;
  try{await navigator.clipboard.writeText(value);toast("주소가 복사되었습니다.")}
  catch{
   const t=document.createElement("textarea");t.value=value;t.style.position="fixed";t.style.opacity="0";
   document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();toast("주소가 복사되었습니다.");
  }
 });
})();