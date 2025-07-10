import styled from 'styled-components'
import womanSvg from '../../assets/images/woman.svg'

const StyledSVG = styled.svg`
  width: 100px;
  height: 100px;
  position: absolute;
  left: 50%;
  bottom: 50%;
  transform: translate(50%, 40%);
`

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  padding: 4rem;
`

export const LoadingSpinner = () => {
  return (
    <>
      <LoadingContainer>
        <div>Looking for some food...</div>
        <img src={womanSvg} style={{ maxHeight: 400 }} alt="" />
        <StyledSVG
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid"
        >
          <animate attributeName="opacity" dur="1s" keyTimes="0;0.4;1" values="0;0;1" />
          <g>
            <circle cx="60" cy="50" r="4" fill="#22aca7">
              <animate
                attributeName="cx"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="95;35"
                keyTimes="0;1"
                begin="-0.6566000000000001s"
              />
              <animate
                attributeName="fill-opacity"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="0;1;1"
                keyTimes="0;0.2;1"
                begin="-0.6566000000000001s"
              />
            </circle>
            <circle cx="60" cy="50" r="4" fill="#22aca7">
              <animate
                attributeName="cx"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="95;35"
                keyTimes="0;1"
                begin="-0.3234s"
              />
              <animate
                attributeName="fill-opacity"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="0;1;1"
                keyTimes="0;0.2;1"
                begin="-0.3234s"
              />
            </circle>
            <circle cx="60" cy="50" r="4" fill="#22aca7">
              <animate
                attributeName="cx"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="95;35"
                keyTimes="0;1"
                begin="0s"
              />
              <animate
                attributeName="fill-opacity"
                repeatCount="indefinite"
                dur="1.0204081632653061s"
                values="0;1;1"
                keyTimes="0;0.2;1"
                begin="0s"
              />
            </circle>
          </g>
        </StyledSVG>
      </LoadingContainer>
    </>
  )
}
